package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.RatingSimulationResponse;
import com.srpfreaks.backend.dto.RatingSimulationResponse.Cutline;
import com.srpfreaks.backend.dto.RatingSimulationResponse.PushedOut;
import com.srpfreaks.backend.dto.RatingSimulationResponse.Simulation;
import com.srpfreaks.backend.dto.RatingSimulationResponse.Status;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.PatternType.RatingGroup;
import com.srpfreaks.backend.mapper.RatingCandidate;
import com.srpfreaks.backend.service.SkillService.ScoredChart;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 곡 상세의 컷라인·시뮬레이션 계산 (D71). DB를 읽지 않는 순수 계산이라 직접 계산한 예시값으로 테스트한다.
 *
 * 수식은 여기에 새로 쓰지 않는다. 점수는 항상 {@link RatingCalculator}(상수 R -> 값 V -> 점수 = V x 20)로 구하고,
 * 목록 선정은 {@link SkillService}의 규칙과 같다: 그룹(단일 / 그 외)마다 점수 높은 순 상위 N개, 같으면 채보 id가 작은 쪽이 먼저.
 * 그래서 설정(rating.*)이 바뀌어도 레이팅 화면과 이 계산이 어긋날 수 없다.
 *
 * "필요 달성률"은 V 공식을 거꾸로 푸는 대신 이분 탐색으로 구한다.
 * 이유: 수식의 모양을 코드 한 곳(RatingCalculator)에만 두기 위해서다. 역산식을 따로 두면 설정이나 수식이 바뀔 때 두 곳을 고쳐야 한다.
 * 달성률이 오르면 점수가 줄어들지 않으므로(95% 이상은 같다) "이 달성률이면 목록에 들어가는가"는 달성률에 대해 단조(한 번 들어가면 계속 들어감)이고,
 * 0.00~100.00을 0.01 단위 정수(0~10000)로 보면 이분 탐색으로 "들어가는 가장 낮은 값"(= 올림한 둘째 자리)을 14번 안팎의 계산으로 찾는다.
 */
public class RatingSimulator {

    private static final int MAX_HUNDREDTHS = 10_000;   // 100.00%를 0.01 단위 정수로

    private final RatingConfig config;
    private final RatingCalculator calculator;

    public RatingSimulator(RatingConfig config, RatingCalculator calculator) {
        this.config = config;
        this.calculator = calculator;
    }

    /**
     * 시뮬레이션 대상 채보. group은 레이팅 대상일 때의 그룹(단일 / 그 외), tier는 서열표 기준 난이도, bestRate는 내 최고 달성률(없으면 null).
     * 레이팅 대상이 아닌 채보(기준 난이도·속성 없음)는 이 클래스에 넘기지 않는다(서비스가 NOT_RATED로 먼저 걸러낸다).
     */
    public record Target(Long chartId, BigDecimal tier, RatingGroup group, BigDecimal bestRate) {
    }

    /** 목록 선정과 합계 계산에 쓰는 한 줄. source는 가상 기록(시뮬레이션 중인 채보)일 때 null이다. */
    private record Item(Long chartId, RatingGroup group, BigDecimal score, ScoredChart source) {
    }

    /**
     * @param rated       내 "레이팅 대상 채보 전체"(SkillService.scoredChartsAll 결과). 목록에 못 든 것도 포함한다.
     * @param achievement 시뮬레이션할 달성률(없으면 컷라인만 계산한다)
     */
    public RatingSimulationResponse simulate(List<ScoredChart> rated, Target target, BigDecimal achievement) {
        int limit = limitOf(target.group());
        List<Item> all = rated.stream().map(c -> new Item(c.candidate().songDifficultyId(), c.pattern().ratingGroup(), c.score(), c)).toList();
        List<Item> groupItems = all.stream().filter(i -> i.group() == target.group()).toList();
        List<Item> others = groupItems.stream().filter(i -> !i.chartId().equals(target.chartId())).toList();

        List<Item> before = top(groupItems, limit);
        Integer rank = rankOf(before, target.chartId());
        Status status = target.bestRate() == null ? Status.NO_RECORD : rank != null ? Status.IN_LIST : Status.OUT_OF_LIST;
        BigDecimal currentScore = target.bestRate() == null ? null : display(scoreAt(target, target.bestRate()));

        boolean groupFull = before.size() >= limit;
        // 컷라인 점수와 필요 달성률은 같은 기준이다: 둘 다 "이 채보를 뺀 나머지(others)"로 계산한다.
        // (D71, 컷라인 숫자 기준 통일) 이미 목록 안인 채보까지 넣어 세면 컷라인 점수가 필요 달성률의 점수와 어긋난다.
        // 목록 밖·기록 없음일 때는 이 채보가 others 안에 없으므로 값이 예전과 같다.
        BigDecimal lastScore = cutlineScore(others, limit);
        BigDecimal required = requiredRate(others, target, limit);
        BigDecimal gap = required == null || target.bestRate() == null ? null : required.subtract(target.bestRate());
        Cutline cutline = new Cutline(lastScore, required, required != null, gap, groupFull);

        Simulation simulation = achievement == null ? null : simulation(all, others, before, target, limit, achievement);
        return new RatingSimulationResponse(status, null, target.group(), limit, before.size(),
                target.bestRate(), currentScore, rank, cutline, simulation);
    }

    /**
     * 컷라인 점수 = 이 채보를 뺀 나머지(others) 중 limit번째(단일 15번째 / 그 외 25번째) 곡의 점수.
     * others가 limit개에 못 미치면 null(= 이 채보는 기록만 있으면 들어간다, 필요 달성률 0.00과 같은 기준).
     */
    private static BigDecimal cutlineScore(List<Item> others, int limit) {
        List<Item> top = top(others, limit);
        return limit > 0 && top.size() >= limit ? display(top.get(limit - 1).score()) : null;
    }

    private Simulation simulation(List<Item> all, List<Item> others, List<Item> before, Target target, int limit,
                                  BigDecimal achievement) {
        // 내 최고 기록보다 낮은 값을 넣어도 실제 최고 기록은 내려가지 않는다. 그래서 최고 기록으로 계산하고 belowBest로 알린다.
        boolean belowBest = target.bestRate() != null && achievement.compareTo(target.bestRate()) < 0;
        BigDecimal effective = belowBest ? target.bestRate() : achievement;

        BigDecimal exactAfter = scoreAt(target, effective);
        Item hypothetical = new Item(target.chartId(), target.group(), exactAfter, null);
        List<Item> after = top(withTarget(others, hypothetical), limit);
        Integer rankAfter = rankOf(after, target.chartId());

        // 합계는 반올림하지 않은 점수로 더하고(D20), 내보낼 때만 둘째 자리로 반올림한다.
        BigDecimal totalBefore = total(all);
        List<Item> allAfter = new ArrayList<>(all.stream().filter(i -> !i.chartId().equals(target.chartId())).toList());
        allAfter.add(hypothetical);
        BigDecimal totalAfter = total(allAfter);

        return new Simulation(effective, belowBest, rankAfter != null, rankAfter, display(exactAfter),
                display(totalBefore), display(totalAfter), display(totalAfter.subtract(totalBefore)),
                pushedOut(before, after, target.chartId()));
    }

    /** 이 채보가 들어와서 목록에서 밀려나는 곡. 목록이 덜 찼거나 이 채보가 못 들어오면 null. */
    private static PushedOut pushedOut(List<Item> before, List<Item> after, Long chartId) {
        for (Item b : before) {
            boolean stillIn = after.stream().anyMatch(a -> a.chartId().equals(b.chartId()));
            if (!stillIn && !b.chartId().equals(chartId) && b.source() != null) {
                RatingCandidate c = b.source().candidate();
                return new PushedOut(c.songDifficultyId(), c.songId(), c.title(), InstrumentPart.valueOf(c.part()),
                        DifficultyType.valueOf(c.difficulty()), c.level(), display(b.score()));
            }
        }
        return null;
    }

    /**
     * 다른 곡들(others)은 그대로 두고, 이 채보가 목록에 들어가는 가장 낮은 달성률(0.01 단위).
     * 100.00으로도 못 들어가면(레이팅 상수가 작아 컷라인을 못 넘음) null.
     */
    private BigDecimal requiredRate(List<Item> others, Target target, int limit) {
        if (limit <= 0 || !enters(others, target, limit, MAX_HUNDREDTHS)) {
            return null;
        }
        int low = 0;
        int high = MAX_HUNDREDTHS;
        while (low < high) {
            int mid = (low + high) / 2;
            if (enters(others, target, limit, mid)) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return BigDecimal.valueOf(low, 2);
    }

    private boolean enters(List<Item> others, Target target, int limit, int hundredths) {
        BigDecimal exact = scoreAt(target, BigDecimal.valueOf(hundredths, 2));
        return rankOf(top(withTarget(others, new Item(target.chartId(), target.group(), exact, null)), limit), target.chartId()) != null;
    }

    /** 이 채보가 달성률 rate일 때의 점수(반올림 전). 상수 R -> 값 V -> 점수는 RatingCalculator 한 곳의 수식이다. */
    private BigDecimal scoreAt(Target target, BigDecimal rate) {
        return calculator.score(calculator.value(calculator.constant(target.tier()), rate));
    }

    private BigDecimal total(List<Item> items) {
        BigDecimal sum = BigDecimal.ZERO;
        for (RatingGroup group : new RatingGroup[] {RatingGroup.SINGLE, RatingGroup.OTHER}) {
            List<Item> inGroup = items.stream().filter(i -> i.group() == group).toList();
            for (Item i : top(inGroup, limitOf(group))) {
                sum = sum.add(i.score());
            }
        }
        return sum;
    }

    private int limitOf(RatingGroup group) {
        return group == RatingGroup.SINGLE ? config.listSingle() : config.listOther();
    }

    /** 점수 높은 순 상위 limit개. 같으면 채보 id가 작은 쪽이 먼저 (SkillService.top과 같은 기준, DESIGN.md 7장). */
    private static List<Item> top(List<Item> items, int limit) {
        return items.stream()
                .sorted(Comparator.comparing(Item::score).reversed().thenComparing(Item::chartId))
                .limit(Math.max(limit, 0))
                .toList();
    }

    private static List<Item> withTarget(List<Item> others, Item target) {
        List<Item> items = new ArrayList<>(others);
        items.add(target);
        return items;
    }

    private static Integer rankOf(List<Item> list, Long chartId) {
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).chartId().equals(chartId)) {
                return i + 1;
            }
        }
        return null;
    }

    private static BigDecimal display(BigDecimal exact) {
        return RatingCalculator.display(exact);
    }
}
