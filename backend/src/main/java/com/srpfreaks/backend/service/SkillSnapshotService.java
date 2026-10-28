package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillSnapshotResponse;
import com.srpfreaks.backend.dto.SkillSnapshotStatusResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SkillSnapshot;
import com.srpfreaks.backend.entity.SkillSnapshotEntry;
import com.srpfreaks.backend.entity.SnapshotGroup;
import com.srpfreaks.backend.repository.SkillSnapshotEntryRepository;
import com.srpfreaks.backend.repository.SkillSnapshotRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

/**
 * 레이팅 스냅샷 (D32). 사용자가 `기록하기`를 눌렀을 때 그 시점의 합계·소계를 하루에 한 줄만 남긴다.
 *  - 계산은 SkillService.mySkill이 그대로 한다(화면의 레이팅과 같은 값). 스냅샷은 그 결과의 사본이다.
 *  - 같은 날(Asia/Seoul) 다시 누르면 새 줄을 만들지 않고 **오늘 줄을 덮어쓴다**(2026-10-27 D32 변경). 가져오기 직후 눌러도
 *    그날 저녁 더 친 결과로 다시 남길 수 있게 하려는 것이다. 지난 날짜의 줄은 건드리지 않는다.
 *  - 막는 경우 두 가지 (순서대로 검사): 레이팅에 들어간 기록이 없음 / 마지막 스냅샷(오늘 줄이 있으면 그 줄)과 합계·소계가 같음.
 *  - 하루 한 줄은 DB의 유일 키(user_id, note_option, snapshot_date)가 마지막으로 보장한다. 그날 첫 기록이 동시에 두 번 눌리면 한 줄만 들어가고 나머지는 SNAPSHOT_ALREADY_TODAY다.
 *  - 대상은 토큰에서 나온 userId뿐이다. 남의 스냅샷은 만들지도 읽지도 못한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SkillSnapshotService {

    public static final int DEFAULT_PAGE_SIZE = 10;
    public static final int MAX_PAGE_SIZE = 50;
    /** "하루"의 기준. 서버 시각(UTC)이 아니라 사용자가 보는 서울 날짜로 센다. */
    static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    private final SkillSnapshotRepository snapshotRepository;
    private final SkillSnapshotEntryRepository entryRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final SkillService skillService;
    private final UserRepository userRepository;
    private final Clock clock;

    /** 최근 순 목록. 각 줄의 증감은 바로 이전(더 오래된) 스냅샷과의 합계 차이고, 가장 오래된 줄은 null이다. */
    public PageResponse<SkillSnapshotResponse> list(Long userId, int page, int size) {
        NoteOption noteOption = skillService.ratingNoteOption(); // 목록은 점수 계산이 필요 없다
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        Page<SkillSnapshot> result = snapshotRepository.findByUser_IdAndNoteOptionOrderBySnapshotDateDesc(
                userId, noteOption, PageRequest.of(pageIndex, pageSize));
        List<SkillSnapshot> rows = result.getContent();

        // 최근 순이라 다음 줄이 더 오래된 스냅샷이다. 페이지의 마지막 줄만 다음 페이지에 있으므로 따로 한 번 더 찾는다.
        List<SkillSnapshotResponse> content = new java.util.ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            SkillSnapshot previous = i + 1 < rows.size()
                    ? rows.get(i + 1)
                    : snapshotRepository.findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(
                            userId, noteOption, rows.get(i).getSnapshotDate()).orElse(null);
            content.add(SkillSnapshotResponse.from(rows.get(i), previous));
        }
        return new PageResponse<>(content, result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    /** 지금 기록할 수 있는지(버튼 상태). create와 같은 검사를 하되 저장하지 않는다. */
    public SkillSnapshotStatusResponse status(Long userId) {
        SkillResponse skill = skillService.mySkill(userId);
        boolean replacesToday = snapshotRepository.existsByUser_IdAndNoteOptionAndSnapshotDate(userId, skill.noteOption(), today());
        return blockReason(userId, skill)
                .map(reason -> SkillSnapshotStatusResponse.blocked(reason, replacesToday))
                .orElseGet(() -> SkillSnapshotStatusResponse.ok(replacesToday));
    }

    @Transactional
    public SkillSnapshotResponse create(Long userId) {
        SkillResponse skill = skillService.mySkill(userId);
        Optional<ErrorCode> blocked = blockReasonCode(userId, skill);
        if (blocked.isPresent()) {
            throw new ApiException(blocked.get());
        }
        LocalDate today = today();
        // 증감은 "어제까지의 마지막 기록" 대비다. 오늘 줄을 덮어쓸 때도 오늘 줄 자신과 비교하지 않는다.
        SkillSnapshot previous = snapshotRepository
                .findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(userId, skill.noteOption(), today)
                .orElse(null);
        Optional<SkillSnapshot> todays = snapshotRepository.findByUser_IdAndNoteOptionAndSnapshotDate(userId, skill.noteOption(), today);
        SkillSnapshot snapshot;
        if (todays.isPresent()) {
            // 오늘 기록 갱신: 점수를 바꾸고(변경 감지로 UPDATE) 상세는 지운 뒤 지금 목록으로 다시 넣는다
            snapshot = todays.get();
            snapshot.replaceScores(skill.totalScore(), skill.singleScore(), skill.otherScore(), averageLevelOf(skill));
            entryRepository.deleteAllBySnapshotId(snapshot.getId());
        } else {
            snapshot = SkillSnapshot.create(userRepository.getReferenceById(userId), skill.noteOption(),
                    today, skill.totalScore(), skill.singleScore(), skill.otherScore(), averageLevelOf(skill));
            try {
                // 유일 키 위반을 여기서 바로 잡으려고 flush까지 한다 (commit 시점이면 이 try 밖에서 터진다)
                snapshotRepository.saveAndFlush(snapshot);
            } catch (DataIntegrityViolationException e) {
                throw new ApiException(ErrorCode.SNAPSHOT_ALREADY_TODAY);
            }
        }
        // 비교용 상세: 이 시점의 레이팅 목록(단일 + 그 외)을 그대로 사본으로 남긴다. 스냅샷과 같은 트랜잭션이라 같이 저장되거나 같이 취소된다.
        entryRepository.saveAll(entriesOf(snapshot, skill));
        return SkillSnapshotResponse.from(snapshot, previous);
    }

    private List<SkillSnapshotEntry> entriesOf(SkillSnapshot snapshot, SkillResponse skill) {
        List<SkillSnapshotEntry> entries = new java.util.ArrayList<>();
        addEntries(entries, snapshot, SnapshotGroup.SINGLE, skill.single());
        addEntries(entries, snapshot, SnapshotGroup.OTHER, skill.other());
        return entries;
    }

    private void addEntries(List<SkillSnapshotEntry> entries, SkillSnapshot snapshot, SnapshotGroup group,
                            List<SkillEntryResponse> source) {
        for (SkillEntryResponse e : source) {
            entries.add(SkillSnapshotEntry.create(snapshot, songDifficultyRepository.getReferenceById(e.songDifficultyId()),
                    group, e.rank(), e.achievementRate(), e.fullCombo(), e.score(), e.tier()));
        }
    }

    /**
     * 레이팅 목록(단일 + 그 외)의 서열표 기준 난이도 평균(소수 둘째 자리 HALF_UP). 홈·세트리스트 추천의 "내 평균"과 같은 식이다.
     * 다만 PlayLevelEstimator처럼 "채보가 충분한가"는 따지지 않고 있는 값으로만 평균을 낸다. 충분한지는 나중에 집계할 때
     * 엔트리 수로 판단할 수 있고, 여기서 버리면 되돌릴 수 없기 때문이다. 기준 난이도가 하나도 없으면 null.
     */
    static BigDecimal averageLevelOf(SkillResponse skill) {
        List<BigDecimal> tiers = java.util.stream.Stream.concat(skill.single().stream(), skill.other().stream())
                .map(SkillEntryResponse::tier).filter(java.util.Objects::nonNull).toList();
        if (tiers.isEmpty()) {
            return null;
        }
        BigDecimal sum = tiers.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(tiers.size()), 2, java.math.RoundingMode.HALF_UP);
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), ZONE);
    }

    private Optional<String> blockReason(Long userId, SkillResponse skill) {
        return blockReasonCode(userId, skill).map(code -> switch (code) {
            case SNAPSHOT_NO_RECORDS -> "NO_RECORDS";
            default -> "NO_CHANGE";
        });
    }

    /**
     * 막는 이유. 순서가 의미 있다: 기록이 있는지 → 마지막 기록과 같은지.
     * "마지막 기록"은 날짜가 가장 늦은 줄이라, 오늘 줄이 있으면 오늘 줄과 비교한다(같은 점수로 덮어쓰는 것을 막는다).
     */
    private Optional<ErrorCode> blockReasonCode(Long userId, SkillResponse skill) {
        if (skill.single().isEmpty() && skill.other().isEmpty()) {
            return Optional.of(ErrorCode.SNAPSHOT_NO_RECORDS);
        }
        boolean unchanged = snapshotRepository
                .findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(userId, skill.noteOption())
                .map(last -> last.hasSameScores(skill.totalScore(), skill.singleScore(), skill.otherScore()))
                .orElse(false);
        return unchanged ? Optional.of(ErrorCode.SNAPSHOT_NO_CHANGE) : Optional.empty();
    }
}
