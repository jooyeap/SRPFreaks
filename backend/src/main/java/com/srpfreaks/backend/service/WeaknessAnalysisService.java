package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.PeerStatsResponse;
import com.srpfreaks.backend.dto.PeerStatsResponse.PeerChartStat;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.dto.WeaknessAnalysisResponse;
import com.srpfreaks.backend.dto.WeaknessAnalysisResponse.BandRow;
import com.srpfreaks.backend.dto.WeaknessAnalysisResponse.EasyChart;
import com.srpfreaks.backend.dto.WeaknessAnalysisResponse.PatternRow;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.LabeledEnum;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.PeerBandAverage;
import com.srpfreaks.backend.mapper.PeerGroupAverage;
import com.srpfreaks.backend.mapper.PeerStatsMapper;
import com.srpfreaks.backend.mapper.RecommendCandidate;
import com.srpfreaks.backend.mapper.SetlistRecommendMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 약점 분석 (D72). 읽기 전용이고 아무것도 저장하지 않는다.
 *
 * 비교 기준(왜 이렇게 했는가): 같은 티어 유저의 데이터로 읽을 수 있는 것은 D53의 스냅샷 레이팅 목록(유저당 최대 40곡)뿐이다.
 * 그래서 양쪽을 같은 기준으로 맞춘다 -> 내 값 = 내 현재 레이팅 목록(단일 15 + 그 외 25)의 달성률 평균,
 * 같은 티어 값 = 같은 티어 공개 유저들의 스냅샷 레이팅 목록 줄의 달성률 평균(채보 가중). 내 전체 기록 평균과 상대의 상위 40곡을 비교하면
 * 항상 내가 낮게 나와 모든 구간이 약점처럼 보이기 때문이다. 다른 유저의 기록(option_records)은 읽지 않는다.
 *
 * 묶음: 속성은 단일 / 복합(복합(단일) 포함) / 이중 / 삼중 4개, 난이도대는 서열표 기준 난이도 0.5 단위(예 5.5~5.9).
 * 약점 후보 = 내 목록 안 채보가 MIN_MY_CHARTS 이상이고 같은 티어 값이 있는 난이도대 중 차이(내 - 같은 티어)가 음수인 것. 그중 차이가 가장 작은 하나가 약점.
 * 올리기 쉬운 곡 = 약점 난이도대의 레이팅 대상 채보 중 같은 티어 유저 중앙값(D53)이 내 최고 기록보다 높고, 그 중앙값으로 쳤을 때 오르는 점수(예상 증가)가 큰 3곡.
 *
 * 보안: 사용자 id는 토큰에서만 온다. 같은 티어 집계는 쿼리가 유저 수·줄 수·평균만 돌려주고(user_id를 읽지 않는다),
 * 묶음마다 서로 다른 유저가 peer.min_chart_users명 이상일 때만 평균을 응답에 담는다. 구간 인원이 peer.min_band_users 미만이면 전부 비운다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WeaknessAnalysisService {

    /** 난이도대 폭(서열표 기준 난이도). 0.1 단위는 한 구간에 채보가 너무 적어 비교가 성립하지 않아 0.5로 묶는다(D72). */
    static final BigDecimal BAND_WIDTH = new BigDecimal("0.5");
    /** 서열표 기준 난이도의 최소 단위. 묶음의 끝 = 시작 + 폭 - 이 값 (5.5 -> 5.9). */
    static final BigDecimal TIER_STEP = new BigDecimal("0.1");
    /** 약점 후보가 되려면 내 레이팅 목록에 이 난이도대 채보가 이만큼 있어야 한다(한두 곡으로 약점을 말하지 않는다). */
    static final int MIN_MY_CHARTS = 3;
    /** 올리기 쉬운 곡 개수. */
    static final int EASY_CHART_COUNT = 3;

    /** 화면에 항상 보여 주는 속성 4개의 순서. */
    static final List<PatternType> PATTERNS = List.of(PatternType.SINGLE, PatternType.COMPOUND, PatternType.DOUBLE,
            PatternType.TRIPLE);

    private final AppSettingRepository appSettingRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final SkillService skillService;
    private final PeerStatsService peerStatsService;
    private final PeerStatsMapper peerMapper;
    private final SetlistRecommendMapper recommendMapper;

    public WeaknessAnalysisResponse analyze(Long userId) {
        Map<String, String> settings = appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue));
        RatingConfig ratingConfig = RatingConfig.from(settings);
        PeerStatsConfig peerConfig = PeerStatsConfig.from(settings);

        SkillResponse mine = skillService.mySkill(userId);
        List<SkillEntryResponse> entries = Stream.concat(mine.single().stream(), mine.other().stream()).toList();
        PlayerTierResponse tier = mine.tier();
        Optional<DifficultyTable> table = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(ratingConfig.noteOption(), TableStatus.ACTIVE);

        // 같은 티어 집계: 티어 구간표나 서열표가 없거나 구간 인원이 모자라면 가져오지 않는다.
        int bandUsers = 0;
        List<PeerGroupAverage> peerPatterns = List.of();
        List<PeerBandAverage> peerBands = List.of();
        boolean peerAvailable = false;
        if (tier != null && table.isPresent()) {
            BigDecimal[] bounds = PeerStatsService.bandBounds(tier);
            String option = ratingConfig.noteOption().name();
            bandUsers = peerMapper.countBandUsers(userId, option, bounds[0], bounds[1]);
            peerAvailable = bandUsers >= peerConfig.minBandUsers();
            if (peerAvailable) {
                Long tableId = table.get().getId();
                String excluded = PatternType.EXCLUDED.getLabel();
                peerPatterns = peerMapper.findPatternAverages(userId, option, bounds[0], bounds[1], tableId, excluded,
                        PatternType.COMPOSITE_SINGLE.getLabel(), PatternType.COMPOUND.getLabel());
                peerBands = peerMapper.findBandAverages(userId, option, bounds[0], bounds[1], tableId, excluded,
                        BAND_WIDTH);
            }
        }

        List<PatternRow> patterns = patternRows(entries, peerPatterns, peerConfig.minChartUsers());
        List<BandRow> bands = bandRows(entries, peerBands, peerConfig.minChartUsers());
        BigDecimal weakFrom = weakBand(bands);
        bands = markWeak(bands, weakFrom);

        List<EasyChart> easy = weakFrom == null || table.isEmpty() ? List.of()
                : easyCharts(userId, ratingConfig, table.get().getId(), weakFrom);

        return new WeaknessAnalysisResponse(tier == null ? null : tier.displayName(), bandUsers, peerAvailable,
                MIN_MY_CHARTS, BAND_WIDTH, patterns, bands, weakFrom, easy);
    }

    // ---- 순수 계산(테스트에서 직접 부른다) ----

    /** 속성 4줄. 복합(단일)은 복합 줄에 합친다(같은 티어 쪽 쿼리도 같은 규칙). */
    static List<PatternRow> patternRows(List<SkillEntryResponse> entries, List<PeerGroupAverage> peers, int minUsers) {
        Map<PatternType, List<BigDecimal>> mine = new EnumMap<>(PatternType.class);
        for (SkillEntryResponse e : entries) {
            PatternType p = foldPattern(parsePattern(e.pattern()));
            if (p != null) {
                mine.computeIfAbsent(p, k -> new ArrayList<>()).add(e.achievementRate());
            }
        }
        Map<String, PeerGroupAverage> peerByLabel = peers.stream()
                .collect(Collectors.toMap(PeerGroupAverage::pattern, Function.identity(), (a, b) -> a));
        List<PatternRow> rows = new ArrayList<>();
        for (PatternType p : PATTERNS) {
            List<BigDecimal> rates = mine.getOrDefault(p, List.of());
            BigDecimal myAvg = average(rates);
            PeerGroupAverage peer = peerByLabel.get(p.getLabel());
            boolean usable = peer != null && peer.users() >= minUsers && peer.avgRate() != null;
            BigDecimal peerAvg = usable ? scale2(peer.avgRate()) : null;
            rows.add(new PatternRow(p.name(), rates.size(), myAvg, peerAvg, usable ? (int) peer.users() : null,
                    diff(myAvg, peerAvg)));
        }
        return rows;
    }

    /** 난이도대 줄. 내 목록에 채보가 있는 난이도대만, 기준 난이도 높은 순. */
    static List<BandRow> bandRows(List<SkillEntryResponse> entries, List<PeerBandAverage> peers, int minUsers) {
        Map<BigDecimal, List<BigDecimal>> mine = new TreeMap<>(Comparator.reverseOrder());
        for (SkillEntryResponse e : entries) {
            if (e.tier() != null) {
                mine.computeIfAbsent(bandOf(e.tier()), k -> new ArrayList<>()).add(e.achievementRate());
            }
        }
        Map<BigDecimal, PeerBandAverage> peerByBand = new HashMap<>();
        for (PeerBandAverage p : peers) {
            peerByBand.putIfAbsent(bandOf(p.band()), p);
        }
        List<BandRow> rows = new ArrayList<>();
        for (Map.Entry<BigDecimal, List<BigDecimal>> m : mine.entrySet()) {
            BigDecimal from = m.getKey();
            BigDecimal myAvg = average(m.getValue());
            PeerBandAverage peer = peerByBand.get(from);
            boolean usable = peer != null && peer.users() >= minUsers && peer.avgRate() != null;
            BigDecimal peerAvg = usable ? scale2(peer.avgRate()) : null;
            rows.add(new BandRow(from, from.add(BAND_WIDTH).subtract(TIER_STEP), m.getValue().size(), myAvg, peerAvg,
                    usable ? (int) peer.users() : null, diff(myAvg, peerAvg), false));
        }
        return rows;
    }

    /** 약점 난이도대의 시작 기준 난이도. 후보(내 채보 수 기준 이상 + 비교값 있음 + 차이 음수) 중 차이가 가장 작은 것, 같으면 기준 난이도가 높은 쪽. 없으면 null. */
    static BigDecimal weakBand(List<BandRow> bands) {
        return bands.stream()
                .filter(b -> b.myCharts() >= MIN_MY_CHARTS && b.diff() != null && b.diff().signum() < 0)
                .min(Comparator.comparing(BandRow::diff).thenComparing(BandRow::tierFrom, Comparator.reverseOrder()))
                .map(BandRow::tierFrom)
                .orElse(null);
    }

    private static List<BandRow> markWeak(List<BandRow> bands, BigDecimal weakFrom) {
        return bands.stream()
                .map(b -> new BandRow(b.tierFrom(), b.tierTo(), b.myCharts(), b.myAvg(), b.peerAvg(), b.peerUsers(),
                        b.diff(), weakFrom != null && b.tierFrom().compareTo(weakFrom) == 0))
                .toList();
    }

    /** 기준 난이도가 속한 묶음의 시작값(FLOOR(T / 폭) x 폭). SQL의 묶음 식과 같다. */
    static BigDecimal bandOf(BigDecimal tier) {
        return tier.divide(BAND_WIDTH, 0, RoundingMode.FLOOR).multiply(BAND_WIDTH).setScale(1, RoundingMode.HALF_UP);
    }

    private static PatternType foldPattern(PatternType p) {
        if (p == PatternType.COMPOSITE_SINGLE) {
            return PatternType.COMPOUND;
        }
        return p == null || p == PatternType.EXCLUDED ? null : p;
    }

    private static BigDecimal average(List<BigDecimal> rates) {
        if (rates.isEmpty()) {
            return null;
        }
        BigDecimal sum = rates.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(rates.size()), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale2(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    /** 표시된 두 평균의 차(내 - 같은 티어). 둘 중 하나가 없으면 null. */
    private static BigDecimal diff(BigDecimal mine, BigDecimal peer) {
        return mine == null || peer == null ? null : mine.subtract(peer);
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

    // ---- 올리기 쉬운 곡 ----

    private List<EasyChart> easyCharts(Long userId, RatingConfig config, Long tableId, BigDecimal weakFrom) {
        BigDecimal hi = weakFrom.add(BAND_WIDTH).subtract(TIER_STEP);
        List<RecommendCandidate> candidates = recommendMapper.findCandidates(userId, config.noteOption().name(), tableId,
                PatternType.EXCLUDED.getLabel(), weakFrom, hi);
        if (candidates.isEmpty()) {
            return List.of();
        }
        Map<Long, RecommendCandidate> byId = candidates.stream()
                .collect(Collectors.toMap(RecommendCandidate::songDifficultyId, Function.identity(), (a, b) -> a));
        PeerStatsResponse stats = peerStatsService.statsForServerChosenCharts(userId, new ArrayList<>(byId.keySet()));
        return stats.charts().stream()
                .filter(c -> c.expectedGain() != null && c.expectedGain().signum() > 0)
                .filter(c -> isBelowMedian(byId.get(c.songDifficultyId()), c))
                .sorted(Comparator.comparing(PeerChartStat::expectedGain).reversed()
                        .thenComparing(PeerChartStat::songDifficultyId))
                .limit(EASY_CHART_COUNT)
                .map(c -> toEasy(byId.get(c.songDifficultyId()), c))
                .toList();
    }

    /** 내 최고 기록이 없거나 같은 티어 중앙값보다 낮을 때만 "올릴 수 있는" 곡이다. */
    private static boolean isBelowMedian(RecommendCandidate c, PeerChartStat stat) {
        return c != null && (c.bestRate() == null || c.bestRate().compareTo(stat.medianRate()) < 0);
    }

    private static EasyChart toEasy(RecommendCandidate c, PeerChartStat stat) {
        return new EasyChart(c.songDifficultyId(), c.songId(), c.title(), InstrumentPart.valueOf(c.part()),
                DifficultyType.valueOf(c.difficulty()), c.level(), c.tier(), c.pattern(), c.bestRate(),
                stat.medianRate(), stat.expectedGain(), stat.users());
    }
}
