package com.srpfreaks.backend.service;

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
 * 차이 규칙(D65와 같음): 점수는 소수 그대로 계산한 뒤 **표시값(둘째 자리 반올림)끼리** 뺀다.
 * 그래야 화면의 `나 238.10`, `상대 235.82`, `+2.28`이 서로 맞는다. 표시값이 같으면 달성률이 달라도 무승부다
 * (점수는 달성률 95%에서 더 오르지 않는다).
 */
public final class RivalSummaryCalculator {

    /** 접전 기준(점). |diff| <= 이 값이면 접전이고 경계(정확히 1.00)도 접전이다. 설정 행을 만들지 않는다. */
    public static final BigDecimal CLOSE_MARGIN = new BigDecimal("1.00");

    /** 속성별 줄의 고정 순서. 공유 곡이 없는 속성도 0으로 항상 내려가 화면 배치가 흔들리지 않는다. */
    public static final List<PatternType> PATTERN_ORDER = List.of(
            PatternType.SINGLE, PatternType.COMPOUND, PatternType.COMPOSITE_SINGLE, PatternType.DOUBLE, PatternType.TRIPLE);

    /** 곡 목록 필터(화이트리스트). LOSE = diff < 0, CLOSE = |diff| <= CLOSE_MARGIN, WIN = diff > 0. */
    public enum Filter { ALL, LOSE, CLOSE, WIN }

    /** 곡 목록 정렬(화이트리스트). 같은 값이면 레벨 높은 순 -> 채보 id 순으로 고정한다. */
    public enum Sort { DIFF_ASC, DIFF_DESC, CLOSE, TITLE }

    /** 두 사람이 모두 기록한 채보 하나와 그 차이. */
    public record Shared(SkillService.ScoredChart mine, SkillService.ScoredChart theirs, BigDecimal myShown,
                         BigDecimal theirShown, BigDecimal diff) {

        public PatternType pattern() {
            return theirs.pattern();
        }

        public RatingCandidate chart() {
            return theirs.candidate();
        }

        public boolean isClose() {
            return diff.abs().compareTo(CLOSE_MARGIN) <= 0;
        }
    }

    private RivalSummaryCalculator() {
    }

    /** 두 사람의 채보 점수 목록에서 둘 다 있는 채보만 골라 차이를 계산한다. */
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
            BigDecimal myShown = RatingCalculator.display(m.score());
            BigDecimal theirShown = RatingCalculator.display(t.score());
            shared.add(new Shared(m, t, myShown, theirShown, myShown.subtract(theirShown)));
        }
        return shared;
    }

    // ---------- 요약 ----------

    public static RivalSummaryResponse summarize(Long userId, String nickname, List<Shared> shared) {
        Map<PatternType, List<Shared>> byPattern = byPattern(shared);
        List<RivalSummaryResponse.PatternSummary> patterns = new ArrayList<>();
        List<RivalSummaryResponse.PatternDiffs> distribution = new ArrayList<>();
        for (PatternType pattern : PATTERN_ORDER) {
            List<Shared> rows = byPattern.getOrDefault(pattern, List.of());
            patterns.add(patternSummary(pattern, rows));
            distribution.add(new RivalSummaryResponse.PatternDiffs(pattern.getLabel(), pattern.name(),
                    rows.stream().map(Shared::diff).sorted().toList()));
        }
        List<Shared> all = shared.stream().filter(s -> PATTERN_ORDER.contains(s.pattern())).toList();
        return new RivalSummaryResponse(userId, nickname, CLOSE_MARGIN, totals(all), patterns, tiers(all), distribution);
    }

    public static RivalSummaryResponse.PatternSummary patternSummary(PatternType pattern, List<Shared> rows) {
        int wins = 0;
        int ties = 0;
        int losses = 0;
        int close = 0;
        BigDecimal sum = BigDecimal.ZERO;
        BigDecimal rateDiffSum = BigDecimal.ZERO;
        int rateCount = 0;
        for (Shared s : rows) {
            int sign = s.diff().signum();
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
            BigDecimal myRate = s.mine().candidate().bestRate();
            BigDecimal theirRate = s.theirs().candidate().bestRate();
            if (myRate != null && theirRate != null) {
                rateDiffSum = rateDiffSum.add(myRate.subtract(theirRate));
                rateCount++;
            }
        }
        return new RivalSummaryResponse.PatternSummary(pattern.getLabel(), pattern.name(), wins, ties, losses,
                sum.setScale(2), close, rows.size(), rateDiffAvg(rateDiffSum, rateCount));
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
            c[s.diff().signum() > 0 ? 0 : s.diff().signum() == 0 ? 1 : 2]++;
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
            case LOSE -> s.diff().signum() < 0;
            case CLOSE -> s.isClose();
            case WIN -> s.diff().signum() > 0;
        };
    }

    public static RivalSummaryDetailResponse.FilterCounts filterCounts(List<Shared> rows) {
        int lose = 0;
        int close = 0;
        int win = 0;
        for (Shared s : rows) {
            lose += matches(Filter.LOSE, s) ? 1 : 0;
            close += matches(Filter.CLOSE, s) ? 1 : 0;
            win += matches(Filter.WIN, s) ? 1 : 0;
        }
        return new RivalSummaryDetailResponse.FilterCounts(rows.size(), lose, close, win);
    }

    /** 정렬을 안 정했을 때의 기본: 열세·전체는 많이 뒤진 순, 우세는 많이 앞선 순, 접전은 차이가 작은 순. */
    public static Sort defaultSort(Filter filter) {
        return switch (filter) {
            case ALL, LOSE -> Sort.DIFF_ASC;
            case WIN -> Sort.DIFF_DESC;
            case CLOSE -> Sort.CLOSE;
        };
    }

    public static Comparator<Shared> comparator(Sort sort) {
        Comparator<Shared> primary = switch (sort) {
            case DIFF_ASC -> Comparator.comparing(Shared::diff);
            case DIFF_DESC -> Comparator.comparing(Shared::diff).reversed();
            case CLOSE -> Comparator.comparing((Shared s) -> s.diff().abs());
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
                AchievementStage.of(s.mine().candidate().bestRate(), s.mine().candidate().fullCombo()), s.myShown(), s.diff());
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
