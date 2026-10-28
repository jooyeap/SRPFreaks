package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PeerStatsResponse;
import com.srpfreaks.backend.dto.PeerStatsResponse.PeerChartStat;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.LabeledEnum;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.PeerChartMeta;
import com.srpfreaks.backend.mapper.PeerChartRate;
import com.srpfreaks.backend.mapper.PeerStatsMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 같은 티어 유저 기록 (D53, D32(5)의 좁은 완화: 개인이 드러나지 않는 집계값에 한해 다른 유저의 스냅샷을 읽는다).
 *
 * 흐름: 내 레이팅으로 내 티어 구간을 구한다 -> (MyBatis) 같은 구간의 공개 유저 수를 센다 -> 기준 미달이면 빈 결과
 *       -> 물어본 채보의 달성률을 모아 채보별 유저 수·중앙값을 구한다 -> 기준을 넘은 채보만 남기고 상승 예상 점수를 붙인다.
 *
 * 규칙 요약
 * - userId는 토큰에서만 온다. 응답에는 유저 식별 정보가 없고 집계값(인원, 중앙값)만 있다.
 * - 나는 집계에서 빠진다(내 기록이 "비슷한 유저" 숫자를 부풀리지 않게).
 * - 기준 인원은 설정(peer.*)이고, 구간 인원이나 채보 인원이 모자라면 그 부분은 응답에 담지 않는다.
 * - 상승 예상 점수 = (중앙값 달성률의 점수) - (지금 내 목록에서 이 채보가 차지할 자리의 점수). 0 미만은 0.
 *     이미 내 목록에 있다 -> 내 현재 점수
 *     없고 해당 그룹(단일/그 외)이 가득 찼다 -> 그 그룹의 최저 점수(이 채보가 들어오면 밀려나는 곡)
 *     없고 그룹이 덜 찼다 -> 0 (어떤 기록이든 들어간다)
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PeerStatsService {

    /** 한 번에 물어볼 수 있는 채보 수(세트리스트 최대 30곡 + 여유). */
    public static final int MAX_CHART_IDS = 50;
    /** 마지막 티어(상한 없음)의 구간 끝으로 쓰는 큰 값. DB 총점(DECIMAL(10,2))보다 크다. */
    private static final BigDecimal NO_UPPER_BOUND = new BigDecimal("10000000");

    private final AppSettingRepository appSettingRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final SkillService skillService;
    private final PeerStatsMapper mapper;

    public PeerStatsResponse stats(Long userId, List<Long> requestedIds) {
        List<Long> chartIds = validated(requestedIds);

        Map<String, String> settings = appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue));
        RatingConfig ratingConfig = RatingConfig.from(settings);
        PeerStatsConfig config = PeerStatsConfig.from(settings);

        SkillResponse mine = skillService.mySkill(userId);
        PlayerTierResponse tier = mine.tier();
        if (tier == null) {
            return new PeerStatsResponse(null, 0, List.of());   // 티어 구간표가 비어 있으면 같은 티어를 정할 수 없다
        }
        BigDecimal lo = BigDecimal.valueOf(tier.minScore());
        BigDecimal hi = tier.nextMinScore() == null ? NO_UPPER_BOUND : BigDecimal.valueOf(tier.nextMinScore());
        String option = ratingConfig.noteOption().name();

        int bandUsers = mapper.countBandUsers(userId, option, lo, hi);
        if (bandUsers < config.minBandUsers()) {
            return new PeerStatsResponse(tier.displayName(), bandUsers, List.of());
        }

        Map<Long, List<BigDecimal>> ratesByChart = mapper.findChartRates(userId, option, lo, hi, chartIds).stream()
                .collect(Collectors.groupingBy(PeerChartRate::songDifficultyId, LinkedHashMap::new,
                        Collectors.mapping(PeerChartRate::rate, Collectors.toList())));

        List<Long> enoughIds = chartIds.stream()
                .filter(id -> ratesByChart.getOrDefault(id, List.of()).size() >= config.minChartUsers())
                .toList();
        if (enoughIds.isEmpty()) {
            return new PeerStatsResponse(tier.displayName(), bandUsers, List.of());
        }

        RatingCalculator calculator = new RatingCalculator(ratingConfig);
        Map<Long, PeerChartMeta> meta = metaOf(ratingConfig, enoughIds);
        Map<Long, SkillEntryResponse> myEntries = Stream.concat(mine.single().stream(), mine.other().stream())
                .collect(Collectors.toMap(SkillEntryResponse::songDifficultyId, Function.identity(), (a, b) -> a));

        List<PeerChartStat> charts = new ArrayList<>();
        for (Long id : enoughIds) {
            List<BigDecimal> rates = ratesByChart.get(id);
            BigDecimal median = median(rates);
            SkillEntryResponse own = myEntries.get(id);
            BigDecimal gain = expectedGain(calculator, meta.get(id), median, own, mine);
            charts.add(new PeerChartStat(id, rates.size(), median, gain, own != null,
                    own == null ? null : own.achievementRate()));
        }
        return new PeerStatsResponse(tier.displayName(), bandUsers, charts);
    }

    private static List<Long> validated(List<Long> requestedIds) {
        if (requestedIds == null || requestedIds.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        LinkedHashSet<Long> unique = new LinkedHashSet<>(requestedIds);
        if (unique.size() > MAX_CHART_IDS || unique.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        return List.copyOf(unique);
    }

    /** 레이팅 서열표에서 채보 값을 읽는다. 서열표가 아직 없으면 빈 맵(상승 예상 점수는 비운다). */
    private Map<Long, PeerChartMeta> metaOf(RatingConfig config, List<Long> chartIds) {
        Optional<DifficultyTable> table = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(config.noteOption(), TableStatus.ACTIVE);
        if (table.isEmpty()) {
            return Map.of();
        }
        Map<Long, PeerChartMeta> result = new HashMap<>();
        for (PeerChartMeta m : mapper.findChartMeta(table.get().getId(), PatternType.EXCLUDED.getLabel(), chartIds)) {
            result.put(m.songDifficultyId(), m);
        }
        return result;
    }

    /** 중앙값. 개수가 짝수면 가운데 두 값의 평균. 소수 둘째 자리까지(HALF_UP). */
    static BigDecimal median(List<BigDecimal> rates) {
        List<BigDecimal> sorted = rates.stream().sorted(Comparator.naturalOrder()).toList();
        int n = sorted.size();
        BigDecimal value = n % 2 == 1
                ? sorted.get(n / 2)
                : sorted.get(n / 2 - 1).add(sorted.get(n / 2)).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    /** 위 클래스 설명의 "상승 예상 점수". 레이팅 대상이 아니거나 서열표 값을 못 찾으면 null. */
    private static BigDecimal expectedGain(RatingCalculator calculator, PeerChartMeta meta, BigDecimal median,
                                           SkillEntryResponse own, SkillResponse mine) {
        if (meta == null || meta.tier() == null) {
            return null;
        }
        PatternType pattern = parsePattern(meta.pattern());
        if (pattern == null || pattern == PatternType.EXCLUDED) {
            return null;
        }
        BigDecimal score = RatingCalculator.display(
                calculator.score(calculator.value(calculator.constant(meta.tier()), median)));
        BigDecimal baseline;
        if (own != null) {
            baseline = own.score();
        } else {
            boolean single = pattern == PatternType.SINGLE;
            List<SkillEntryResponse> group = single ? mine.single() : mine.other();
            int limit = single ? mine.singleLimit() : mine.otherLimit();
            boolean full = !group.isEmpty() && group.size() >= limit;
            baseline = full ? group.get(group.size() - 1).score() : BigDecimal.ZERO;
        }
        return score.subtract(baseline).max(BigDecimal.ZERO);
    }

    private static PatternType parsePattern(String label) {
        if (label == null) {
            return null;
        }
        try {
            return LabeledEnum.fromLabel(PatternType.class, label);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
