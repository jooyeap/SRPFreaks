package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.RivalCounts;
import com.srpfreaks.backend.dto.RivalSummaryDetailResponse;
import com.srpfreaks.backend.dto.RivalSummaryResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.mapper.RatingCandidate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/**
 * 라이벌 대시보드 집계의 순수 계산(D67). DB·스프링 없이 테스트할 수 있게 서비스에서 분리했다.
 *
 * 입력은 "두 사람의 (채보 점수) 목록"뿐이다. 범위를 레이팅 목록 밖으로 넓히거나 줄일 때(구간·기간 필터 등)
 * 입력 목록만 바꾸면 되도록 집계 규칙은 이 클래스 한 곳에 둔다.
 *
 * **판정 규칙은 달성률 차다(D67 개정, 2026-11-09).** rateDiff = 내 달성률 - 상대 달성률(DB의 DECIMAL(5,2) 값끼리 그대로 뺀 %p, 반올림 없음).
 * 승 > 0, 패 < 0, 무 = 0(달성률이 정확히 같을 때만), 접전 |rateDiff| <= CLOSE_MARGIN(1.00%p, 경계 포함).
 * 화면의 곡 줄 칩(`+1.84%`)과 판정이 같은 값이다. 예전(5단계)에는 점수 차(표시 둘째 자리끼리 뺀 값)로 판정했는데,
 * 점수는 달성률 95%부터 같아져서 95% 이상 구간이 모두 무가 되고 칩과 어긋났다.
 * 점수 차(diff)는 옛 응답 필드(scoreDiffSum·distribution·row.diff)를 위해 계산만 남기고 판정·정렬에는 쓰지 않는다.
 * 레이팅 점수·랭킹·총점 차는 이 클래스와 상관없다.
 *
 * 한쪽만 기록한 곡은 승·무·패·평균에 넣지 않고(0%로 보지 않는다) 속성별 곡 수(onlyTheirs/onlyMine)로만 센다.
 */
public final class RivalSummaryCalculator {

    /** 접전 기준(%p). |달성률 차| <= 이 값이면 접전이고 경계(정확히 1.00)도 접전이다. 설정 행을 만들지 않는다. */
    public static final BigDecimal CLOSE_MARGIN = new BigDecimal("1.00");

    /** 속성별 줄의 고정 순서. 공유 곡이 없는 속성도 0으로 항상 내려가 화면 배치가 흔들리지 않는다. */
    public static final List<PatternType> PATTERN_ORDER = List.of(
            PatternType.SINGLE, PatternType.COMPOUND, PatternType.COMPOSITE_SINGLE, PatternType.DOUBLE, PatternType.TRIPLE);

    /**
     * 곡 목록 필터(화이트리스트). 달성률 차 기준: LOSE = 차 < 0, CLOSE = |차| <= CLOSE_MARGIN, WIN = 차 > 0.
     * THEIRS_ONLY(2026-11-10)는 상대만 기록한(나는 기록이 없는) 레이팅 대상 채보다. 공유 곡이 아니라서 {@link #matches}는 항상 false이고
     * 목록은 {@link #onlyTheirsCharts}로 따로 만든다(곡별 승패 `상대만` 탭과 같은 정의).
     */
    public enum Filter { ALL, LOSE, CLOSE, WIN, THEIRS_ONLY }

    /** 곡 목록 정렬(화이트리스트). 같은 값이면 레벨 높은 순 -> 채보 id 순으로 고정한다. */
    public enum Sort { DIFF_ASC, DIFF_DESC, CLOSE, TITLE }

    /**
     * 두 사람이 모두 기록한 채보 하나와 그 차이. rateDiff = 내 달성률 - 상대 달성률(%p, 판정·정렬 기준),
     * diff = 점수 차(표시 둘째 자리끼리 뺀 값, 옛 필드용이라 판정에 쓰지 않는다).
     */
    public record Shared(SkillService.ScoredChart mine, SkillService.ScoredChart theirs, BigDecimal myShown,
                         BigDecimal theirShown, BigDecimal diff, BigDecimal rateDiff) {

        public PatternType pattern() {
            return theirs.pattern();
        }

        public RatingCandidate chart() {
            return theirs.candidate();
        }

        public boolean isClose() {
            return rateDiff.abs().compareTo(CLOSE_MARGIN) <= 0;
        }
    }

    /** 한쪽만 기록한 레이팅 대상 곡 수(속성별). onlyTheirs = 상대만, onlyMine = 나만. */
    public record Unmatched(Map<PatternType, Integer> onlyTheirs, Map<PatternType, Integer> onlyMine) {

        public static final Unmatched NONE = new Unmatched(Map.of(), Map.of());

        int theirs(PatternType p) {
            return onlyTheirs.getOrDefault(p, 0);
        }

        int mine(PatternType p) {
            return onlyMine.getOrDefault(p, 0);
        }
    }

    private RivalSummaryCalculator() {
    }

    /** 두 사람의 채보 점수 목록에서 둘 다 있는 채보만 골라 차이를 계산한다(달성률이 없는 줄은 건너뛴다). */
    public static List<Shared> share(List<SkillService.ScoredChart> mine, List<SkillService.ScoredChart> theirs) {
        Map<Long, SkillService.ScoredChart> myById = new HashMap<>();
        for (SkillService.ScoredChart m : mine) {
            myById.put(m.candidate().songDifficultyId(), m);
        }
        List<Shared> shared = new ArrayList<>();
        for (SkillService.ScoredChart t : theirs) {
            SkillService.ScoredChart m = myById.get(t.candidate().songDifficultyId());
            if (m == null) {
                continue;
            }
            BigDecimal myRate = m.candidate().bestRate();
            BigDecimal theirRate = t.candidate().bestRate();
            if (myRate == null || theirRate == null) {
                continue;
            }
            BigDecimal myShown = RatingCalculator.display(m.score());
            BigDecimal theirShown = RatingCalculator.display(t.score());
            shared.add(new Shared(m, t, myShown, theirShown, myShown.subtract(theirShown), myRate.subtract(theirRate)));
        }
        return shared;
    }

    /** 한쪽만 기록한 레이팅 대상 채보를 속성별로 센다(속성 목록 밖은 센다 하지 않는다). 승·무·패·평균과 무관하다. */
    public static Unmatched unmatched(List<SkillService.ScoredChart> mine, List<SkillService.ScoredChart> theirs) {
        java.util.Set<Long> myIds = new java.util.HashSet<>();
        for (SkillService.ScoredChart m : mine) {
            myIds.add(m.candidate().songDifficultyId());
        }
        java.util.Set<Long> theirIds = new java.util.HashSet<>();
        for (SkillService.ScoredChart t : theirs) {
            theirIds.add(t.candidate().songDifficultyId());
        }
        Map<PatternType, Integer> onlyTheirs = new EnumMap<>(PatternType.class);
        Map<PatternType, Integer> onlyMine = new EnumMap<>(PatternType.class);
        for (SkillService.ScoredChart t : theirs) {
            if (!myIds.contains(t.candidate().songDifficultyId()) && PATTERN_ORDER.contains(t.pattern())) {
                onlyTheirs.merge(t.pattern(), 1, Integer::sum);
            }
        }
        for (SkillService.ScoredChart m : mine) {
            if (!theirIds.contains(m.candidate().songDifficultyId()) && PATTERN_ORDER.contains(m.pattern())) {
                onlyMine.merge(m.pattern(), 1, Integer::sum);
            }
        }
        return new Unmatched(onlyTheirs, onlyMine);
    }

    // ---------- 요약 ----------

    public static RivalSummaryResponse summarize(Long userId, String nickname, List<Shared> shared) {
        return summarize(userId, nickname, shared, Unmatched.NONE);
    }

    public static RivalSummaryResponse summarize(Long userId, String nickname, List<Shared> shared, Unmatched unmatched) {
        return summarize(userId, nickname, shared, unmatched, Map.of());
    }

    /**
     * ratingScoreDiff = 속성별 레이팅 목록 기준 점수 차(내 - 상대, 반올림하지 않은 합의 차를 둘째 자리로). 속성 키가 없으면 그 속성은 0.00이다.
     * 레이팅 목록 계산을 못 구한 호출(빈 맵)이면 모든 속성이 null이다.
     */
    public static RivalSummaryResponse summarize(Long userId, String nickname, List<Shared> shared, Unmatched unmatched,
                                                 Map<PatternType, BigDecimal> ratingScoreDiff) {
        Map<PatternType, List<Shared>> byPattern = byPattern(shared);
        List<RivalSummaryResponse.PatternSummary> patterns = new ArrayList<>();
        List<RivalSummaryResponse.PatternDiffs> distribution = new ArrayList<>();
        List<RivalSummaryResponse.PatternDiffs> rateDistribution = new ArrayList<>();
        for (PatternType pattern : PATTERN_ORDER) {
            List<Shared> rows = byPattern.getOrDefault(pattern, List.of());
            patterns.add(patternSummary(pattern, rows, unmatched, ratingScoreDiff));
            distribution.add(new RivalSummaryResponse.PatternDiffs(pattern.getLabel(), pattern.name(),
                    rows.stream().map(Shared::diff).sorted().toList()));
            rateDistribution.add(new RivalSummaryResponse.PatternDiffs(pattern.getLabel(), pattern.name(),
                    rows.stream().map(Shared::rateDiff).sorted().toList()));
        }
        List<Shared> all = shared.stream().filter(s -> PATTERN_ORDER.contains(s.pattern())).toList();
        return new RivalSummaryResponse(userId, nickname, CLOSE_MARGIN, totals(all), patterns, tiers(all), distribution,
                rateDistribution);
    }

    public static RivalSummaryResponse.PatternSummary patternSummary(PatternType pattern, List<Shared> rows) {
        return patternSummary(pattern, rows, Unmatched.NONE);
    }

    public static RivalSummaryResponse.PatternSummary patternSummary(PatternType pattern, List<Shared> rows,
                                                                     Unmatched unmatched) {
        return patternSummary(pattern, rows, unmatched, Map.of());
    }

    public static RivalSummaryResponse.PatternSummary patternSummary(PatternType pattern, List<Shared> rows,
                                                                     Unmatched unmatched,
                                                                     Map<PatternType, BigDecimal> ratingScoreDiff) {
        int wins = 0;
        int ties = 0;
        int losses = 0;
        int close = 0;
        BigDecimal sum = BigDecimal.ZERO;
        BigDecimal rateDiffSum = BigDecimal.ZERO;
        int rateCount = 0;
        for (Shared s : rows) {
            int sign = s.rateDiff().signum();
            if (sign > 0) {
                wins++;
            } else if (sign < 0) {
                losses++;
            } else {
                ties++;
            }
            if (s.isClose()) {
                close++;
            }
            sum = sum.add(s.diff());
            rateDiffSum = rateDiffSum.add(s.rateDiff());
            rateCount++;
        }
        return new RivalSummaryResponse.PatternSummary(pattern.getLabel(), pattern.name(), wins, ties, losses,
                sum.setScale(2), close, rows.size(), rateDiffAvg(rateDiffSum, rateCount), unmatched.theirs(pattern),
                unmatched.mine(pattern), ratingScoreDiff.isEmpty() ? null
                        : RatingCalculator.display(ratingScoreDiff.getOrDefault(pattern, BigDecimal.ZERO)));
    }

    /**
     * 속성별 레이팅 목록 점수 차(반올림 전): (내 레이팅 목록 속성별 점수 합) - (상대 레이팅 목록 속성별 점수 합).
     * 입력은 {@code SkillService.ratingListScoreByPattern}의 두 사람 값(속성별 반올림하지 않은 합)이다. 어느 한쪽에만 있는 속성도 0으로 보고 뺀다.
     * 속성별 값을 모두 더하면 총점 차와 같다(총점이 레이팅 목록 40채보 점수 합이라서). 입력이 하나도 없으면 빈 맵(= 계산 못 함).
     */
    public static Map<PatternType, BigDecimal> ratingScoreDiff(Map<PatternType, BigDecimal> mine, Map<PatternType, BigDecimal> theirs) {
        if (mine == null || theirs == null) {
            return Map.of();
        }
        Map<PatternType, BigDecimal> diff = new EnumMap<>(PatternType.class);
        for (PatternType p : PATTERN_ORDER) {
            diff.put(p, mine.getOrDefault(p, BigDecimal.ZERO).subtract(theirs.getOrDefault(p, BigDecimal.ZERO)));
        }
        return diff;
    }

    /**
     * 상대만 기록한(나는 기록이 없는) 레이팅 대상 채보(속성 목록 안). 곡별 승패의 `상대만` 탭과 속성 상세의 `상대만` 필터가 같은 정의를 쓰도록 여기 한 곳에 둔다.
     * 순서는 상대 달성률 높은 순 → 레벨 높은 순 → 채보 id.
     */
    public static List<SkillService.ScoredChart> onlyTheirsCharts(List<SkillService.ScoredChart> mine,
                                                                 List<SkillService.ScoredChart> theirs) {
        java.util.Set<Long> myIds = new java.util.HashSet<>();
        for (SkillService.ScoredChart m : mine) {
            myIds.add(m.candidate().songDifficultyId());
        }
        return theirs.stream()
                .filter(t -> PATTERN_ORDER.contains(t.pattern()))
                .filter(t -> !myIds.contains(t.candidate().songDifficultyId()))
                .sorted(Comparator.comparing((SkillService.ScoredChart t) -> t.candidate().bestRate(), Comparator.reverseOrder())
                        .thenComparing((SkillService.ScoredChart t) -> t.candidate().level(), Comparator.reverseOrder())
                        .thenComparing(t -> t.candidate().songDifficultyId()))
                .toList();
    }

    /** 나만 기록한(상대는 기록이 없는) 레이팅 대상 채보(속성 목록 안). 난이도대별 집계에서 공유 곡이 없는 난이도도 한 줄로 보이게 하는 데만 쓴다. */
    public static List<SkillService.ScoredChart> onlyMineCharts(List<SkillService.ScoredChart> mine,
                                                               List<SkillService.ScoredChart> theirs) {
        return onlyTheirsCharts(theirs, mine);
    }

    /** 상대만 기록한 곡 한 줄. 내 기록 필드(myRate·myStage·myScore·diff·rateDiff)는 모두 null이다. */
    public static RivalSummaryDetailResponse.Row toTheirsOnlyRow(SkillService.ScoredChart t) {
        RatingCandidate c = t.candidate();
        return new RivalSummaryDetailResponse.Row(c.songDifficultyId(), c.songId(), c.title(),
                InstrumentPart.valueOf(c.part()), DifficultyType.valueOf(c.difficulty()), c.level(), c.tier(),
                t.pattern().getLabel(), c.bestRate(), AchievementStage.of(c.bestRate(), c.fullCombo()),
                RatingCalculator.display(t.score()), null, null, null, null, null);
    }

    /**
     * 한 속성의 난이도대별(서열표 기준 난이도 0.1 단위, 높은 난이도 먼저) 집계. 두 사람 중 누구라도 그 속성에 기록한 곡이 있는 난이도마다 한 줄이고,
     * 공유 곡이 없는 난이도는 sharedCount 0 / rateDiffAvg null이다. 승·무·패·접전은 속성 요약과 같은 달성률 차 기준이다.
     */
    public static List<RivalSummaryDetailResponse.TierRow> tierRows(List<Shared> shared,
                                                                    List<SkillService.ScoredChart> onlyOne) {
        Map<BigDecimal, List<Shared>> byTier = new TreeMap<>(Comparator.reverseOrder());
        for (Shared s : shared) {
            byTier.computeIfAbsent(tierKey(s.chart().tier()), k -> new ArrayList<>()).add(s);
        }
        for (SkillService.ScoredChart c : onlyOne) {
            byTier.computeIfAbsent(tierKey(c.candidate().tier()), k -> new ArrayList<>());
        }
        List<RivalSummaryDetailResponse.TierRow> rows = new ArrayList<>();
        byTier.forEach((tier, list) -> {
            RivalSummaryResponse.PatternSummary p = patternSummary(PatternType.SINGLE, list);
            rows.add(new RivalSummaryDetailResponse.TierRow(tier, p.wins(), p.ties(), p.losses(), p.closeCount(),
                    p.sharedCount(), p.rateDiffAvg()));
        });
        return rows;
    }

    private static BigDecimal tierKey(BigDecimal tier) {
        return tier.setScale(1, java.math.RoundingMode.HALF_UP);
    }

    /**
     * 달성률 차 평균(%p): 합 ÷ 곡 수를 소수 첫째 자리로 반올림한다(HALF_UP = 절반은 0에서 먼 쪽, 예 -0.05 -> -0.1).
     * 평균을 먼저 내고 한 번만 반올림하므로 화면이 값을 다시 반올림하지 않는다. 곡이 없으면 null(0이 아니다).
     */
    static BigDecimal rateDiffAvg(BigDecimal rateDiffSum, int count) {
        if (count <= 0) {
            return null;
        }
        return rateDiffSum.divide(BigDecimal.valueOf(count), 1, java.math.RoundingMode.HALF_UP);
    }

    /** 속성 목록 안의 공유 곡 전체의 합계(요약의 totals와 같다). 곡별 승패 보기의 승·패·무 개수가 이 값을 그대로 쓴다. */
    public static RivalSummaryResponse.Totals totalsOf(List<Shared> shared) {
        return totals(shared.stream().filter(s -> PATTERN_ORDER.contains(s.pattern())).toList());
    }

    /**
     * 승·패·무·상대만·나만 개수를 한 번에(D67 개정). **라이벌 카드(`GET /rivals`)·비교 레이팅 목록(`compare/rating`)·곡별 승패(`compare/charts`)의
     * 개수가 모두 이 한 곳에서 나온다**(대시보드 요약 totals·속성별 onlyTheirs 합과 같은 값이라 화면의 숫자가 갈라지지 않는다).
     * 입력은 두 사람의 레이팅 대상 채보 점수 목록이고, 판정은 달성률 차다.
     */
    public static RivalCounts countsOf(List<SkillService.ScoredChart> mine, List<SkillService.ScoredChart> theirs) {
        RivalSummaryResponse.Totals totals = totalsOf(share(mine, theirs));
        Unmatched unmatched = unmatched(mine, theirs);
        return new RivalCounts(totals.wins(), totals.losses(), totals.ties(), totalOnlyTheirs(unmatched), totalOnlyMine(unmatched));
    }

    /** 달성률이 정확히 같은 곡(무). 승·패는 {@link #matches}의 WIN·LOSE와 같은 부호 규칙이다. */
    public static boolean isTie(Shared s) {
        return s.rateDiff().signum() == 0;
    }

    /** 속성별 미플레이 곡 수의 합(상대만). 곡별 승패의 `상대만` 탭 개수와 같다. */
    public static int totalOnlyTheirs(Unmatched unmatched) {
        return PATTERN_ORDER.stream().mapToInt(unmatched::theirs).sum();
    }

    /** 속성별 미플레이 곡 수의 합(나만). */
    public static int totalOnlyMine(Unmatched unmatched) {
        return PATTERN_ORDER.stream().mapToInt(unmatched::mine).sum();
    }

    private static RivalSummaryResponse.Totals totals(List<Shared> all) {
        RivalSummaryResponse.PatternSummary t = patternSummary(PatternType.SINGLE, all);
        return new RivalSummaryResponse.Totals(t.wins(), t.ties(), t.losses(), t.closeCount(), t.sharedCount(), t.scoreDiffSum());
    }

    private static List<RivalSummaryResponse.TierSummary> tiers(List<Shared> all) {
        // 기준 난이도는 0.1 단위다. 같은 값이 다른 자릿수로 들어와도 한 줄이 되도록 소수 첫째 자리로 맞춘다.
        Map<BigDecimal, int[]> byTier = new TreeMap<>(Comparator.reverseOrder());
        for (Shared s : all) {
            BigDecimal tier = s.chart().tier().setScale(1, java.math.RoundingMode.HALF_UP);
            int[] c = byTier.computeIfAbsent(tier, k -> new int[3]);
            c[s.rateDiff().signum() > 0 ? 0 : s.rateDiff().signum() == 0 ? 1 : 2]++;
        }
        List<RivalSummaryResponse.TierSummary> result = new ArrayList<>();
        byTier.forEach((tier, c) -> result.add(new RivalSummaryResponse.TierSummary(tier, c[0], c[1], c[2])));
        return result;
    }

    static Map<PatternType, List<Shared>> byPattern(List<Shared> shared) {
        Map<PatternType, List<Shared>> map = new EnumMap<>(PatternType.class);
        for (Shared s : shared) {
            if (PATTERN_ORDER.contains(s.pattern())) {
                map.computeIfAbsent(s.pattern(), k -> new ArrayList<>()).add(s);
            }
        }
        return map;
    }

    // ---------- 곡 목록 ----------

    public static boolean matches(Filter filter, Shared s) {
        return switch (filter) {
            case ALL -> true;
            case LOSE -> s.rateDiff().signum() < 0;
            case CLOSE -> s.isClose();
            case WIN -> s.rateDiff().signum() > 0;
            case THEIRS_ONLY -> false;   // 공유 곡이 아니다. 상대만 기록한 곡은 onlyTheirsCharts로 따로 센다
        };
    }

    public static RivalSummaryDetailResponse.FilterCounts filterCounts(List<Shared> rows) {
        return filterCounts(rows, 0);
    }

    public static RivalSummaryDetailResponse.FilterCounts filterCounts(List<Shared> rows, int theirsOnly) {
        int lose = 0;
        int close = 0;
        int win = 0;
        for (Shared s : rows) {
            lose += matches(Filter.LOSE, s) ? 1 : 0;
            close += matches(Filter.CLOSE, s) ? 1 : 0;
            win += matches(Filter.WIN, s) ? 1 : 0;
        }
        return new RivalSummaryDetailResponse.FilterCounts(rows.size(), lose, close, win, theirsOnly);
    }

    /** 정렬을 안 정했을 때의 기본: 열세·전체는 많이 뒤진 순, 우세는 많이 앞선 순, 접전은 차이가 작은 순. */
    public static Sort defaultSort(Filter filter) {
        return switch (filter) {
            case ALL, LOSE -> Sort.DIFF_ASC;
            case WIN -> Sort.DIFF_DESC;
            case CLOSE -> Sort.CLOSE;
            case THEIRS_ONLY -> Sort.TITLE;   // 상대만 목록은 정렬 인자를 쓰지 않는다(상대 달성률 높은 순 고정). 이 값은 자리 채움이다
        };
    }

    public static Comparator<Shared> comparator(Sort sort) {
        Comparator<Shared> primary = switch (sort) {
            case DIFF_ASC -> Comparator.comparing(Shared::rateDiff);
            case DIFF_DESC -> Comparator.comparing(Shared::rateDiff).reversed();
            case CLOSE -> Comparator.comparing((Shared s) -> s.rateDiff().abs());
            case TITLE -> Comparator.comparing((Shared s) -> s.chart().title(), String.CASE_INSENSITIVE_ORDER);
        };
        return primary
                .thenComparing((Shared s) -> s.chart().level(), Comparator.reverseOrder())
                .thenComparing(s -> s.chart().songDifficultyId());
    }

    public static RivalSummaryDetailResponse.Row toRow(Shared s) {
        RatingCandidate c = s.chart();
        return new RivalSummaryDetailResponse.Row(c.songDifficultyId(), c.songId(), c.title(),
                InstrumentPart.valueOf(c.part()), DifficultyType.valueOf(c.difficulty()), c.level(), c.tier(),
                s.pattern().getLabel(), c.bestRate(), AchievementStage.of(c.bestRate(), c.fullCombo()), s.theirShown(),
                s.mine().candidate().bestRate(),
                AchievementStage.of(s.mine().candidate().bestRate(), s.mine().candidate().fullCombo()), s.myShown(), s.diff(),
                s.rateDiff());
    }

    // ---------- 요청 값 해석(화이트리스트) ----------

    /** 속성 키(`SINGLE` 등). 목록 밖(`EXCLUDED` 포함)이면 null. */
    public static PatternType parsePattern(String key) {
        if (key == null) {
            return null;
        }
        for (PatternType p : PATTERN_ORDER) {
            if (p.name().equalsIgnoreCase(key.strip())) {
                return p;
            }
        }
        return null;
    }

    /** 필터. 비우면 ALL, 목록 밖이면 null. */
    public static Filter parseFilter(String value) {
        return value == null || value.isBlank() ? Filter.ALL : parseEnum(Filter.class, value);
    }

    /** 정렬. 목록 밖이면 null(비어 있는 값은 호출부가 defaultSort로 처리한다). */
    public static Sort parseSort(String value) {
        return value == null || value.isBlank() ? null : parseEnum(Sort.class, value);
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String value) {
        try {
            return Enum.valueOf(type, value.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
