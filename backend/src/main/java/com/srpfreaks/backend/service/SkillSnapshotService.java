package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillSnapshotResponse;
import com.srpfreaks.backend.dto.SkillSnapshotStatusResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SkillSnapshot;
import com.srpfreaks.backend.repository.SkillSnapshotRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

/**
 * 레이팅 스냅샷 (D32). 사용자가 `기록하기`를 눌렀을 때 그 시점의 합계·소계를 하루에 한 줄만 남긴다.
 *  - 계산은 SkillService.mySkill이 그대로 한다(화면의 레이팅과 같은 값). 스냅샷은 그 결과의 사본이다.
 *  - 막는 경우 세 가지 (순서대로 검사): 오늘(Asia/Seoul) 이미 기록함 / 레이팅에 들어간 기록이 없음 / 마지막 스냅샷과 합계·소계가 같음.
 *  - 하루 1회는 DB의 유일 키(user_id, note_option, snapshot_date)가 마지막으로 보장한다. 동시에 두 번 눌려 검사를 둘 다 통과해도 한 줄만 들어간다.
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
        return blockReason(userId, skill).map(SkillSnapshotStatusResponse::blocked).orElseGet(SkillSnapshotStatusResponse::ok);
    }

    @Transactional
    public SkillSnapshotResponse create(Long userId) {
        SkillResponse skill = skillService.mySkill(userId);
        Optional<ErrorCode> blocked = blockReasonCode(userId, skill);
        if (blocked.isPresent()) {
            throw new ApiException(blocked.get());
        }
        SkillSnapshot previous = snapshotRepository
                .findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(userId, skill.noteOption()).orElse(null);
        SkillSnapshot snapshot = SkillSnapshot.create(userRepository.getReferenceById(userId), skill.noteOption(),
                today(), skill.totalScore(), skill.singleScore(), skill.otherScore());
        try {
            // 유일 키 위반을 여기서 바로 잡으려고 flush까지 한다 (commit 시점이면 이 try 밖에서 터진다)
            snapshotRepository.saveAndFlush(snapshot);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.SNAPSHOT_ALREADY_TODAY);
        }
        return SkillSnapshotResponse.from(snapshot, previous);
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), ZONE);
    }

    private Optional<String> blockReason(Long userId, SkillResponse skill) {
        return blockReasonCode(userId, skill).map(code -> switch (code) {
            case SNAPSHOT_ALREADY_TODAY -> "ALREADY_TODAY";
            case SNAPSHOT_NO_RECORDS -> "NO_RECORDS";
            default -> "NO_CHANGE";
        });
    }

    /** 막는 이유. 순서가 의미 있다: 오늘 이미 했는지 → 기록이 있는지 → 마지막 기록과 같은지. */
    private Optional<ErrorCode> blockReasonCode(Long userId, SkillResponse skill) {
        if (snapshotRepository.existsByUser_IdAndNoteOptionAndSnapshotDate(userId, skill.noteOption(), today())) {
            return Optional.of(ErrorCode.SNAPSHOT_ALREADY_TODAY);
        }
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
