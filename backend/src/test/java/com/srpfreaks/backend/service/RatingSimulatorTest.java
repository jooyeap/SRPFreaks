package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.RatingSimulationResponse;
import com.srpfreaks.backend.dto.RatingSimulationResponse.Status;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.PatternType.RatingGroup;
import com.srpfreaks.backend.mapper.RatingCandidate;
import com.srpfreaks.backend.service.RatingSimulator.Target;
import com.srpfreaks.backend.service.SkillService.ScoredChart;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 컷라인·시뮬레이션 계산 검증 (D71). 모두 손으로 계산한 값이다.
 * 설정: 기준점 6.0, R = 5T-15(T>6) / 10T-45, 80, 95, 3.2, x20. 목록 개수는 계산을 쉽게 하려고 단일 3 / 그 외 2로 줄였다.
 *
 * 기준 난이도 6.0(R=15)의 점수: A=0 -> 0, A=70 -> 210, A=80 -> 240, A=90 -> 282.6667, A=95·100 -> 304 (V=15.2 x 20).
 * 기준 난이도 7.0(R=20)의 A=100 점수: V = 20x0.8 + 3.2 = 19.2 -> 384.
 */
class RatingSimulatorTest {

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    private static RatingConfig config(int single, int other) {
        return new RatingConfig(bd("6.0"), bd("5"), bd("15"), bd("10"), bd("45"),
                bd("80"), bd("95"), bd("3.2"), bd("20"), single, other, NoteOption.SUPER_RANDOM_PLUS);
    }

    private static RatingSimulator simulator(int single, int other) {
        RatingConfig config = config(single, other);
        return new RatingSimulator(config, new RatingCalculator(config));
    }

    /** 이미 계산된 점수를 가진 "내 레이팅 대상 채보" 한 줄. */
    private static ScoredChart rated(long id, PatternType pattern, String score) {
        RatingCandidate candidate = new RatingCandidate(id, 100 + id, "곡" + id, "GUITAR", "MASTER", bd("9.50"),
                bd("6.0"), pattern.getLabel(), bd("90.00"), false, null);
        return new ScoredChart(candidate, pattern, bd(score));
    }

    /** 단일 그룹: 304, 304, 240 (가득 찬 3칸), 180 (목록 밖). */
    private static List<ScoredChart> singleGroup() {
        return List.of(rated(1, PatternType.SINGLE, "304"), rated(2, PatternType.SINGLE, "304"),
                rated(3, PatternType.SINGLE, "240"), rated(4, PatternType.SINGLE, "180"));
    }

    private static Target target(long id, String tier, String best) {
        return new Target(id, bd(tier), RatingGroup.SINGLE, best == null ? null : bd(best));
    }

    @Test
    void 기록이_없으면_컷라인_달성률에서_시작한다() {
        RatingSimulationResponse r = simulator(3, 2).simulate(singleGroup(), target(10, "6.0", null), null);

        assertThat(r.status()).isEqualTo(Status.NO_RECORD);
        assertThat(r.group()).isEqualTo(RatingGroup.SINGLE);
        assertThat(r.groupLimit()).isEqualTo(3);
        assertThat(r.groupSize()).isEqualTo(3);
        assertThat(r.cutline().groupFull()).isTrue();
        assertThat(r.cutline().lastScore()).isEqualByComparingTo("240.00");
        // 달성률 80.00이면 점수가 240으로 같아 채보 id가 큰(10 > 3) 이쪽이 밀린다. 80.01부터 들어간다.
        assertThat(r.cutline().requiredRate()).isEqualByComparingTo("80.01");
        assertThat(r.cutline().reachable()).isTrue();
        assertThat(r.cutline().rateGap()).isNull();
        assertThat(r.simulation()).isNull();
    }

    @Test
    void 점수가_같으면_채보_id가_작은_쪽이_먼저라_필요_달성률이_80_00이다() {
        List<ScoredChart> others = List.of(rated(5, PatternType.SINGLE, "304"), rated(6, PatternType.SINGLE, "304"),
                rated(7, PatternType.SINGLE, "240"));

        RatingSimulationResponse r = simulator(3, 2).simulate(others, target(1, "6.0", null), null);

        assertThat(r.cutline().requiredRate()).isEqualByComparingTo("80.00");
    }

    @Test
    void 이미_목록_안이면_순위와_컷라인까지_여유를_준다() {
        List<ScoredChart> list = new java.util.ArrayList<>(singleGroup());
        list.add(rated(10, PatternType.SINGLE, "282.6666666667"));   // 내 기록 90.00 -> V=14.1333 -> 점수 282.67

        RatingSimulationResponse r = simulator(3, 2).simulate(list, target(10, "6.0", "90.00"), null);

        assertThat(r.status()).isEqualTo(Status.IN_LIST);
        assertThat(r.currentRank()).isEqualTo(3);
        assertThat(r.currentRate()).isEqualByComparingTo("90.00");
        assertThat(r.currentScore()).isEqualByComparingTo("282.67");
        // 다른 곡 기준 필요 달성률 80.01, 내 기록이 90.00이니 9.99만큼 여유(음수)
        assertThat(r.cutline().requiredRate()).isEqualByComparingTo("80.01");
        assertThat(r.cutline().rateGap()).isEqualByComparingTo("-9.99");
    }

    @Test
    void 목록_밖이면_필요_달성률과_더_올릴_양을_준다() {
        List<ScoredChart> list = new java.util.ArrayList<>(singleGroup());
        list.add(rated(10, PatternType.SINGLE, "210"));   // 내 기록 70.00 -> V=10.5 -> 점수 210

        RatingSimulationResponse r = simulator(3, 2).simulate(list, target(10, "6.0", "70.00"), null);

        assertThat(r.status()).isEqualTo(Status.OUT_OF_LIST);
        assertThat(r.currentRank()).isNull();
        assertThat(r.cutline().requiredRate()).isEqualByComparingTo("80.01");
        assertThat(r.cutline().rateGap()).isEqualByComparingTo("10.01");
    }

    @Test
    void 목록이_모자라면_기록만_있어도_들어가서_필요_달성률이_0_00이다() {
        List<ScoredChart> few = List.of(rated(1, PatternType.SINGLE, "304"), rated(2, PatternType.SINGLE, "240"));

        RatingSimulationResponse r = simulator(3, 2).simulate(few, target(10, "6.0", null), null);

        assertThat(r.cutline().groupFull()).isFalse();
        assertThat(r.cutline().lastScore()).isNull();
        assertThat(r.cutline().requiredRate()).isEqualByComparingTo("0.00");
        assertThat(r.groupSize()).isEqualTo(2);
    }

    @Test
    void 달성률_100으로도_못_들어가면_도달_불가로_알린다() {
        List<ScoredChart> strong = List.of(rated(1, PatternType.SINGLE, "384"), rated(2, PatternType.SINGLE, "384"),
                rated(3, PatternType.SINGLE, "384"));

        RatingSimulationResponse r = simulator(3, 2).simulate(strong, target(10, "6.0", null), bd("100.00"));

        assertThat(r.cutline().requiredRate()).isNull();
        assertThat(r.cutline().reachable()).isFalse();
        assertThat(r.simulation().entered()).isFalse();
        assertThat(r.simulation().rank()).isNull();
        assertThat(r.simulation().pushedOut()).isNull();
    }

    @Test
    void 시뮬레이션_95면_3위로_들어가고_3번째_곡이_밀려난다() {
        RatingSimulationResponse r = simulator(3, 2).simulate(singleGroup(), target(10, "6.0", null), bd("95.00"));

        RatingSimulationResponse.Simulation s = r.simulation();
        assertThat(s.achievement()).isEqualByComparingTo("95.00");
        assertThat(s.belowBest()).isFalse();
        // 점수 304로 먼저 있던 1, 2번(id가 작음)과 같아 3위, 240점이던 3번 곡이 밀려난다
        assertThat(s.entered()).isTrue();
        assertThat(s.rank()).isEqualTo(3);
        assertThat(s.scoreAfter()).isEqualByComparingTo("304.00");
        assertThat(s.totalBefore()).isEqualByComparingTo("848.00");   // 304 + 304 + 240
        assertThat(s.totalAfter()).isEqualByComparingTo("912.00");    // 304 x 3
        assertThat(s.totalChange()).isEqualByComparingTo("64.00");
        assertThat(s.pushedOut().songDifficultyId()).isEqualTo(3L);
        assertThat(s.pushedOut().score()).isEqualByComparingTo("240.00");
    }

    @Test
    void 달성률_0과_100은_경계값이다() {
        RatingSimulationResponse zero = simulator(3, 2).simulate(singleGroup(), target(10, "6.0", null), bd("0.00"));
        RatingSimulationResponse full = simulator(3, 2).simulate(singleGroup(), target(10, "6.0", null), bd("100.00"));

        assertThat(zero.simulation().scoreAfter()).isEqualByComparingTo("0.00");
        assertThat(zero.simulation().entered()).isFalse();
        assertThat(zero.simulation().totalChange()).isEqualByComparingTo("0.00");
        // 95% 이상은 값이 같아서 100.00도 304
        assertThat(full.simulation().scoreAfter()).isEqualByComparingTo("304.00");
        assertThat(full.simulation().rank()).isEqualTo(3);
    }

    @Test
    void 달성률_80이면_점수_240으로_동점이라_id가_큰_채보는_못_들어간다() {
        RatingSimulationResponse r = simulator(3, 2).simulate(singleGroup(), target(10, "6.0", null), bd("80.00"));

        assertThat(r.simulation().scoreAfter()).isEqualByComparingTo("240.00");
        assertThat(r.simulation().entered()).isFalse();
    }

    @Test
    void 내_최고_기록보다_낮게_넣으면_최고_기록으로_계산하고_변화가_없다() {
        List<ScoredChart> list = new java.util.ArrayList<>(singleGroup());
        list.add(rated(10, PatternType.SINGLE, "282.6666666667"));

        RatingSimulationResponse r = simulator(3, 2).simulate(list, target(10, "6.0", "90.00"), bd("85.00"));

        assertThat(r.simulation().belowBest()).isTrue();
        assertThat(r.simulation().achievement()).isEqualByComparingTo("90.00");
        assertThat(r.simulation().totalChange()).isEqualByComparingTo("0.00");
        assertThat(r.simulation().rank()).isEqualTo(3);
        assertThat(r.simulation().pushedOut()).isNull();   // 이미 안이라 밀려나는 곡이 없다
    }

    @Test
    void 기준_난이도가_6_0_전후면_레이팅상수식이_바뀐다() {
        // T=6.1 -> R=15.5, 100% -> V=15.5x0.8+3.2=15.6 -> 312
        RatingSimulationResponse above = simulator(3, 2).simulate(List.of(), target(10, "6.1", null), bd("100.00"));
        // T=5.9 -> R=14, 100% -> V=14x0.8+3.2=14.4 -> 288
        RatingSimulationResponse below = simulator(3, 2).simulate(List.of(), target(10, "5.9", null), bd("100.00"));

        assertThat(above.simulation().scoreAfter()).isEqualByComparingTo("312.00");
        assertThat(below.simulation().scoreAfter()).isEqualByComparingTo("288.00");
    }

    @Test
    void 단일과_그_외는_따로_센다() {
        // 그 외 그룹(복합) 500점 한 곡이 있어도 단일 컷라인과 필요 달성률은 그대로, 합계에는 더해진다
        List<ScoredChart> list = new java.util.ArrayList<>(singleGroup());
        list.add(rated(20, PatternType.COMPOUND, "500"));

        RatingSimulationResponse r = simulator(3, 2).simulate(list, target(10, "6.0", null), bd("95.00"));

        assertThat(r.cutline().requiredRate()).isEqualByComparingTo("80.01");
        assertThat(r.groupSize()).isEqualTo(3);
        assertThat(r.simulation().totalBefore()).isEqualByComparingTo("1348.00");   // 848 + 500
        assertThat(r.simulation().totalAfter()).isEqualByComparingTo("1412.00");
        assertThat(r.simulation().totalChange()).isEqualByComparingTo("64.00");
    }

    @Test
    void 그_외_그룹_채보는_그_외_그룹_안에서만_겨룬다() {
        List<ScoredChart> others = List.of(rated(20, PatternType.COMPOUND, "304"), rated(21, PatternType.DOUBLE, "240"));
        Target other = new Target(30L, bd("6.0"), RatingGroup.OTHER, null);

        RatingSimulationResponse r = simulator(3, 2).simulate(others, other, bd("95.00"));

        assertThat(r.group()).isEqualTo(RatingGroup.OTHER);
        assertThat(r.groupLimit()).isEqualTo(2);
        // 그 외 2칸이 가득 차 있고(304, 240) 점수 304로 들어가면 240점 곡이 밀려난다
        assertThat(r.simulation().rank()).isEqualTo(2);
        assertThat(r.simulation().pushedOut().songDifficultyId()).isEqualTo(21L);
    }
}
