package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SetlistRecommendationResponse;
import com.srpfreaks.backend.dto.SetlistRecommendationResponse.Item;
import com.srpfreaks.backend.dto.SetlistRecommendationResponse.Reason;
import com.srpfreaks.backend.dto.SetlistRecommendationResponse.Status;
import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.SetlistRecommendRange;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.RecommendCandidate;
import com.srpfreaks.backend.mapper.SetlistRecommendMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.SetlistRecommendRangeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 세트리스트 추천(D37). 내 평균 난이도(PlayLevelEstimator)를 기준으로 오늘 도전해 볼 채보를 두 묶음으로 골라 준다.
 *
 * - 범위는 서버 기본값이고, 사용자가 직접 정한 값(setlist_recommend_ranges)이 있으면 그 값을 쓴다.
 * - SS 기준: 평균 + ssMin ~ ssMax 안(기본 -0.6 ~ -0.1, 평균보다 쉬운 쪽), 기록이 없거나 SS 미만(FC·EXC는 SS 이상으로 본다 - 달성 단계 규칙, D24).
 * - S 기준: 평균 + sMin ~ sMax 안(기본 -0.1 ~ +0.4), 기록이 없거나 S 미만이고 SS 기준에 들어가지 않은 것.
 * - 레이팅 목록이 비어 있으면(신규) 평균이 없으므로 기준 난이도 starterTier(5.2) 이하에서 S 미만인 채보만 S 기준으로 보여 준다(STARTER).
 * - 단일 / 그 외 채보가 최소 개수 미만이면 추천하지 않고 개수만 알려 준다(INSUFFICIENT).
 * - 이미 세트리스트에 담은 채보와 레이팅 대상이 아닌 채보(미정·레이팅 제외·반영 꺼짐)는 쿼리에서 빠진다.
 * - 비슷한 실력대 근거(D89, READY만): 같은 티어 공개 유저(나 제외)가 레이팅에 반영한 채보는 각 묶음 맨 앞에 반영 인원 많은 순으로 놓고(reason=PEER_TIER, peerUsers=인원),
 *   채보별 인원이 peer.min_chart_users 미만이거나 구간 인원이 peer.min_band_users 미만이거나 이미 내 레이팅 목록에 든 채보는 근거 없이 아래 기존 정렬로 둔다(reason=NEAR_AVERAGE).
 *   후보를 늘리거나 줄이지 않고 순서와 근거만 바꾼다(범위 조정·SS/S 판정·담은 채보 제외는 그대로).
 * - 정렬: 기준 난이도(평균 또는 starterTier)에 가까운 순이 먼저, 같으면 기록 없는 채보, 내 최고 달성률이 낮은 순, 채보 id 순(요청마다 순서가 바뀌지 않게).
 * - 두 묶음을 각각 자기 page(ssPage / sPage)로 size개씩 넘긴다. 조회는 두 범위를 합친 한 번이고 단계 판정·정렬·페이지는 여기(Java)에서 한다.
 * userId는 토큰에서만 오고, 남의 기록은 쿼리에서 user_id 조건으로 섞이지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SetlistRecommendService {

    public static final int DEFAULT_PAGE_SIZE = 5;
    public static final int MAX_PAGE_SIZE = 10;

    /** 추천이 기준으로 삼는 기록·서열표의 노트 옵션. 기록은 SRN+ 하나만 받는다(D25). */
    static final NoteOption RECORD_OPTION = NoteOption.SUPER_RANDOM_PLUS;

    private final AppSettingRepository appSettingRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final SetlistRecommendMapper recommendMapper;
    private final PlayLevelEstimator playLevelEstimator;
    private final SetlistRecommendRangeRepository rangeRepository;
    private final PeerRecommendEvidence peerEvidence;

    /** 잘못된 page/size는 400이 아니라 허용 범위로 맞춘다(목록 API 공통 방식). */
    public SetlistRecommendationResponse recommend(Long userId, int ssPage, int sPage, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int ssIndex = Math.max(ssPage, 0);
        int sIndex = Math.max(sPage, 0);
        SetlistRecommendConfig config = SetlistRecommendConfig.from(appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue)));
        // 사용자가 직접 정한 범위가 있으면 서버 기본 범위 대신 쓴다(개수·입문 난이도는 서버 설정 그대로)
        Optional<SetlistRecommendRange> custom = rangeRepository.findByUserId(userId);
        if (custom.isPresent()) {
            SetlistRecommendRange r = custom.get();
            config = config.withRanges(r.getSsMin(), r.getSsMax(), r.getSMin(), r.getSMax());
        }
        boolean customRange = custom.isPresent();

        Optional<DifficultyTable> table = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(RECORD_OPTION, TableStatus.ACTIVE);
        if (table.isEmpty()) {
            return empty(Status.UNAVAILABLE, null, 0, 0, config, customRange, ssIndex, sIndex, pageSize);
        }

        PlayLevelEstimate estimate = playLevelEstimator.estimate(userId);
        return switch (estimate.status()) {
            case INSUFFICIENT -> empty(Status.INSUFFICIENT, null, estimate.ratedSingle(), estimate.ratedOther(),
                    config, customRange, ssIndex, sIndex, pageSize);
            case NEW_PLAYER -> starter(userId, table.get(), config, customRange, ssIndex, sIndex, pageSize);
            case READY -> ready(userId, table.get(), estimate, config, customRange, ssIndex, sIndex, pageSize);
        };
    }

    private SetlistRecommendationResponse ready(Long userId, DifficultyTable table, PlayLevelEstimate estimate,
                                                SetlistRecommendConfig config, boolean customRange,
                                                int ssIndex, int sIndex, int pageSize) {
        BigDecimal base = estimate.tier();
        // 두 범위를 합친 가장 넓은 구간으로 한 번만 조회하고, 각 묶음의 범위는 아래에서 다시 거른다
        BigDecimal lo = base.add(config.ssMin().min(config.sMin()));
        BigDecimal hi = base.add(config.ssMax().max(config.sMax()));
        List<RecommendCandidate> candidates = recommendMapper.findCandidates(userId, RECORD_OPTION.name(),
                table.getId(), PatternType.EXCLUDED.getLabel(), lo, hi);

        // 근거 인원: 이미 내 레이팅 목록에 있는 채보는 "새로 반영할 곡"이 아니므로 근거에서 뺀다
        PeerRecommendEvidence.Evidence evidence = peerEvidence.of(userId);
        Map<Long, Integer> peer = evidence.usersByChart().entrySet().stream()
                .filter(e -> !evidence.myRatedIds().contains(e.getKey()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        Comparator<RecommendCandidate> order = order(base);
        List<RecommendCandidate> ss = candidates.stream()
                .filter(c -> within(c, base, config.ssMin(), config.ssMax()) && below(c, AchievementStage.SS))
                .sorted(order).toList();
        List<RecommendCandidate> s = candidates.stream()
                .filter(c -> !ss.contains(c) && within(c, base, config.sMin(), config.sMax()) && below(c, AchievementStage.S))
                .sorted(order).toList();
        return response(Status.READY, base, estimate.ratedSingle(), estimate.ratedOther(), config, customRange,
                peerFirst(ss, peer), peerFirst(s, peer), peer, true, ssIndex, sIndex, pageSize);
    }

    /** 레이팅 목록이 비어 있는 신규 사용자: starterTier 이하에서 S 미만인 채보만, S 기준 묶음으로. */
    private SetlistRecommendationResponse starter(Long userId, DifficultyTable table, SetlistRecommendConfig config,
                                                  boolean customRange, int ssIndex, int sIndex, int pageSize) {
        BigDecimal top = config.starterTier();
        List<RecommendCandidate> candidates = recommendMapper.findCandidates(userId, RECORD_OPTION.name(),
                table.getId(), PatternType.EXCLUDED.getLabel(), BigDecimal.ZERO, top);
        List<RecommendCandidate> s = candidates.stream()
                .filter(c -> c.tier().compareTo(top) <= 0 && below(c, AchievementStage.S))
                .sorted(order(top)).toList();
        // 신규는 평균도 티어도 없어 근거 칩을 달지 않는다(reason 없음)
        return response(Status.STARTER, top, 0, 0, config, customRange, List.of(), s, Map.of(), false, ssIndex, sIndex, pageSize);
    }

    private static SetlistRecommendationResponse response(Status status, BigDecimal base, int ratedSingle, int ratedOther,
                                                          SetlistRecommendConfig config, boolean customRange,
                                                          List<RecommendCandidate> ss, List<RecommendCandidate> s,
                                                          Map<Long, Integer> peer, boolean withReason,
                                                          int ssIndex, int sIndex, int pageSize) {
        return new SetlistRecommendationResponse(status, base, config.ssMin(), config.ssMax(), config.sMin(), config.sMax(), customRange,
                ratedSingle, ratedOther, config.minSingle(), config.minOther(),
                slice(ss, peer, withReason, ssIndex, pageSize), slice(s, peer, withReason, sIndex, pageSize), ssIndex, sIndex, pageSize,
                pages(ss.size(), pageSize), pages(s.size(), pageSize));
    }

    private static SetlistRecommendationResponse empty(Status status, BigDecimal base, int ratedSingle, int ratedOther,
                                                       SetlistRecommendConfig config, boolean customRange,
                                                       int ssIndex, int sIndex, int pageSize) {
        return response(status, base, ratedSingle, ratedOther, config, customRange, List.of(), List.of(), Map.of(), false, ssIndex, sIndex, pageSize);
    }

    /** 기준 난이도가 base + min ~ base + max 안(경계 포함)인가. */
    private static boolean within(RecommendCandidate c, BigDecimal base, BigDecimal min, BigDecimal max) {
        BigDecimal diff = c.tier().subtract(base);
        return diff.compareTo(min) >= 0 && diff.compareTo(max) <= 0;
    }

    /** 기록이 없거나, 기록의 달성 단계가 limit보다 낮은가. (SS 미만 = S+ 이하, FC·EXC는 SS 이상이다. S+는 S 이상이라 "S 미만"에는 들지 않는다, D83) */
    private static boolean below(RecommendCandidate c, AchievementStage limit) {
        AchievementStage stage = stageOf(c);
        return stage == null || stage.compareTo(limit) < 0;
    }

    private static AchievementStage stageOf(RecommendCandidate c) {
        return c.bestRate() == null ? null : AchievementStage.of(c.bestRate(), Boolean.TRUE.equals(c.fullCombo()));
    }

    private static Comparator<RecommendCandidate> order(BigDecimal baseTier) {
        // 가까운 순이 첫 기준이다. 예전에는 기록 없음이 먼저여서 평균에서 먼 곡이 맨 위에 올 수 있었다.
        return Comparator
                .comparing((RecommendCandidate c) -> c.tier().subtract(baseTier).abs())
                .thenComparing(c -> c.bestRate() != null)                       // false(기록 없음)가 먼저
                .thenComparing(c -> c.bestRate() == null ? BigDecimal.ZERO : c.bestRate())
                .thenComparing(RecommendCandidate::songDifficultyId);
    }

    private static int pages(int count, int size) {
        return (count + size - 1) / size;
    }

    /**
     * 근거 있는 채보(peer에 id가 있는 것)를 반영 인원 많은 순으로 앞에 놓고, 나머지는 원래 순서 그대로 뒤에 붙인다.
     * List.sort는 안정 정렬이라 인원이 같으면 기존 정렬(가까운 순 등)이 유지된다.
     */
    private static List<RecommendCandidate> peerFirst(List<RecommendCandidate> sorted, Map<Long, Integer> peer) {
        if (peer.isEmpty()) {
            return sorted;
        }
        List<RecommendCandidate> backed = sorted.stream().filter(c -> peer.containsKey(c.songDifficultyId()))
                .sorted(Comparator.comparing((RecommendCandidate c) -> peer.get(c.songDifficultyId())).reversed()).toList();
        List<RecommendCandidate> rest = sorted.stream().filter(c -> !peer.containsKey(c.songDifficultyId())).toList();
        return Stream.concat(backed.stream(), rest.stream()).toList();
    }

    private static List<Item> slice(List<RecommendCandidate> all, Map<Long, Integer> peer, boolean withReason, int page, int size) {
        int from = (int) Math.min((long) page * size, all.size());
        int to = Math.min(from + size, all.size());
        return all.subList(from, to).stream().map(c -> toItem(c, peer, withReason)).toList();
    }

    private static Item toItem(RecommendCandidate c, Map<Long, Integer> peer, boolean withReason) {
        Integer peerUsers = peer.get(c.songDifficultyId());
        Reason reason = !withReason ? null : peerUsers != null ? Reason.PEER_TIER : Reason.NEAR_AVERAGE;
        AchievementStage stage = stageOf(c);
        MyRecord mine = stage == null ? null : new MyRecord(c.bestRate(), Boolean.TRUE.equals(c.fullCombo()), stage);
        return new Item(c.songDifficultyId(), c.songId(), c.title(), InstrumentPart.valueOf(c.part()),
                DifficultyType.valueOf(c.difficulty()), c.level(), c.tier(), c.pattern(), mine, peerUsers, reason);
    }
}
