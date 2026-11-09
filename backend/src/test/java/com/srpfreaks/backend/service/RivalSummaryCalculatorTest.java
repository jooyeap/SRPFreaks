package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.RivalSummaryDetailResponse;
import com.srpfreaks.backend.dto.RivalSummaryResponse;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.mapper.RatingCandidate;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 라이벌 대시보드 집계의 순수 계산(D67). **판정은 달성률 차(%p)다**(D67 개정): 승/무/패/접전 경계(±1.00, ±1.01), 속성·서열 난이도 집계,
 * 한쪽만 기록한 곡 수. 점수 차(scoreDiffSum·distribution)는 옛 필드라 값만 확인한다.
 */
class RivalSummaryCalculatorTest {

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    /** 채보 하나: 판정은 달성률(rate), 점수(score)는 옛 필드(점수 차 합계·분포)에만 쓴다. */
    private static SkillService.ScoredChart chart(long id, PatternType pattern, String tier, String score, String rate) {
        RatingCandidate c = new RatingCandidate(id, 100 + id, "곡" + id, "GUITAR", "MASTER", d("9.50"), d(tier), pattern.getLabel(),
                d(rate), false, null);
        return new SkillService.ScoredChart(c, pattern, d(score));
    }

    /** 점수는 신경 쓰지 않는 테스트용(같은 점수 200.00). */
    private static SkillService.ScoredChart rateChart(long id, PatternType pattern, String tier, String rate) {
        return chart(id, pattern, tier, "200.00", rate);
    }

    /** 속성 하나에 채보 하나: 내 달성률 / 상대 달성률. */
    private static List<RivalSummaryCalculator.Shared> shared(PatternType pattern, String myRate, String theirRate) {
        return RivalSummaryCalculator.share(List.of(rateChart(1, pattern, "5.6", myRate)), List.of(rateChart(1, pattern, "5.6", theirRate)));
    }

    // ---------- 승/무/패/접전 경계 (달성률 차, %p) ----------

    @Test
    void 달성률_차_양수는_승_음수는_패_0은_무() {
        assertThat(shared(PatternType.SINGLE, "90.01", "90.00").get(0).rateDiff()).isEqualByComparingTo("0.01");
        assertThat(RivalSummaryCalculator.summarize(1L, "a", shared(PatternType.SINGLE, "90.01", "90.00")).totals().wins()).isEqualTo(1);
        assertThat(RivalSummaryCalculator.summarize(1L, "a", shared(PatternType.SINGLE, "90.00", "90.01")).totals().losses()).isEqualTo(1);
        RivalSummaryResponse tie = RivalSummaryCalculator.summarize(1L, "a", shared(PatternType.SINGLE, "90.00", "90.00"));
        assertThat(tie.totals().ties()).isEqualTo(1);
        assertThat(tie.totals().closeCount()).isEqualTo(1);   // 무도 접전에 든다
    }

    @Test
    void 달성률_95_이상이라도_달성률이_다르면_승패가_갈린다_점수가_같아도() {
        // 97.50 대 99.80: 점수는 둘 다 같게(달성률 95%부터 점수가 같아진다) 두어도 판정은 달성률로 패, diff -2.30
        List<RivalSummaryCalculator.Shared> rows = RivalSummaryCalculator.share(
                List.of(chart(1, PatternType.SINGLE, "5.6", "304.00", "97.50")), List.of(chart(1, PatternType.SINGLE, "5.6", "304.00", "99.80")));
        assertThat(rows.get(0).diff()).isEqualByComparingTo("0.00");          // 점수 차(옛 필드)는 0
        assertThat(rows.get(0).rateDiff()).isEqualByComparingTo("-2.30");     // 판정 기준은 달성률 차
        RivalSummaryResponse.PatternSummary p = pattern(RivalSummaryCalculator.summarize(1L, "a", rows), "SINGLE");
        assertThat(p.losses()).isEqualTo(1);
        assertThat(p.ties()).isZero();
        assertThat(p.wins()).isZero();
        assertThat(p.scoreDiffSum()).isEqualByComparingTo("0.00");            // 옛 필드는 점수 기준 그대로
        assertThat(p.rateDiffAvg()).isEqualByComparingTo("-2.3");
        // 달성률이 정확히 같을 때만 무: 100.00 대 100.00
        assertThat(pattern(RivalSummaryCalculator.summarize(1L, "a", shared(PatternType.SINGLE, "100.00", "100.00")), "SINGLE").ties()).isEqualTo(1);
    }

    @Test
    void 접전은_달성률_차_절댓값_1_00까지_경계_포함() {
        assertThat(isClose("91.00", "90.00")).isTrue();     // +1.00
        assertThat(isClose("89.00", "90.00")).isTrue();     // -1.00
        assertThat(isClose("91.01", "90.00")).isFalse();    // +1.01
        assertThat(isClose("88.99", "90.00")).isFalse();    // -1.01
        assertThat(isClose("90.00", "90.00")).isTrue();     // 0.00
        // +1.00은 접전이면서 승, +1.01은 승이지만 접전이 아니다
        RivalSummaryResponse.PatternSummary edge = pattern(RivalSummaryCalculator.summarize(1L, "a", shared(PatternType.DOUBLE, "91.00", "90.00")), "DOUBLE");
        assertThat(edge.wins()).isEqualTo(1);
        assertThat(edge.closeCount()).isEqualTo(1);
        RivalSummaryResponse.PatternSummary out = pattern(RivalSummaryCalculator.summarize(1L, "a", shared(PatternType.DOUBLE, "91.01", "90.00")), "DOUBLE");
        assertThat(out.wins()).isEqualTo(1);
        assertThat(out.closeCount()).isZero();
    }

    private static boolean isClose(String myRate, String theirRate) {
        return shared(PatternType.DOUBLE, myRate, theirRate).get(0).isClose();
    }

    @Test
    void 달성률_차는_둘째_자리_값을_반올림_없이_그대로_뺀다() {
        RivalSummaryCalculator.Shared s = shared(PatternType.TRIPLE, "96.15", "95.14").get(0);
        assertThat(s.rateDiff()).isEqualByComparingTo("1.01");
        assertThat(s.isClose()).isFalse();
        assertThat(shared(PatternType.TRIPLE, "80.00", "79.99").get(0).rateDiff()).isEqualByComparingTo("0.01");
        assertThat(shared(PatternType.TRIPLE, "100.00", "0.00").get(0).rateDiff()).isEqualByComparingTo("100.00");
    }

    @Test
    void 점수_차는_옛_필드용으로_표시_둘째_자리_값끼리_뺀다() {
        // 소수 그대로면 차이가 1.004지만 화면에 보이는 값(10.00 - 9.00)은 1.00이다(옛 scoreDiffSum·distribution 계산)
        RivalSummaryCalculator.Shared s = RivalSummaryCalculator.share(
                List.of(chart(1, PatternType.TRIPLE, "5.6", "10.004", "90.00")), List.of(chart(1, PatternType.TRIPLE, "5.6", "9.000", "90.00"))).get(0);
        assertThat(s.myShown()).isEqualByComparingTo("10.00");
        assertThat(s.diff()).isEqualByComparingTo("1.00");
        assertThat(s.rateDiff()).isEqualByComparingTo("0.00");
    }

    // ---------- 범위: 둘 다 기록이 있는 채보 ----------

    @Test
    void 한쪽만_기록한_채보는_세지_않는다() {
        List<SkillService.ScoredChart> mine = List.of(rateChart(1, PatternType.SINGLE, "5.6", "95.00"), rateChart(2, PatternType.SINGLE, "5.6", "90.00"));
        List<SkillService.ScoredChart> theirs = List.of(rateChart(1, PatternType.SINGLE, "5.6", "90.00"), rateChart(3, PatternType.SINGLE, "5.6", "85.00"));
        List<RivalSummaryCalculator.Shared> shared = RivalSummaryCalculator.share(mine, theirs);
        assertThat(shared).hasSize(1);
        assertThat(shared.get(0).chart().songDifficultyId()).isEqualTo(1L);
    }

    @Test
    void 표본이_없으면_모든_값이_0이고_속성_다섯_줄은_그대로_내려간다() {
        RivalSummaryResponse r = RivalSummaryCalculator.summarize(7L, "Rumi", List.of());
        assertThat(r.totals().sharedCount()).isZero();
        assertThat(r.totals().scoreDiffSum()).isEqualByComparingTo("0.00");
        assertThat(r.patterns()).extracting(RivalSummaryResponse.PatternSummary::key)
                .containsExactly("SINGLE", "COMPOUND", "COMPOSITE_SINGLE", "DOUBLE", "TRIPLE");
        assertThat(r.patterns()).extracting(RivalSummaryResponse.PatternSummary::pattern)
                .containsExactly("단일", "복합", "복합(단일)", "이중", "삼중");
        assertThat(r.patterns()).allSatisfy(p -> assertThat(p.sharedCount()).isZero());
        assertThat(r.tiers()).isEmpty();
        assertThat(r.distribution()).hasSize(5).allSatisfy(p -> assertThat(p.diffs()).isEmpty());
        assertThat(r.rateDistribution()).hasSize(5).allSatisfy(p -> assertThat(p.diffs()).isEmpty());
        assertThat(r.patterns()).allSatisfy(p -> {
            assertThat(p.onlyTheirs()).isZero();
            assertThat(p.onlyMine()).isZero();
        });
        assertThat(r.closeMargin()).isEqualByComparingTo("1.00");
    }

    @Test
    void 레이팅_제외_속성은_집계에서_빠진다() {
        List<RivalSummaryCalculator.Shared> shared = shared(PatternType.EXCLUDED, "100.00", "50.00");
        assertThat(RivalSummaryCalculator.unmatched(List.of(rateChart(1, PatternType.EXCLUDED, "5.6", "90.00")), List.of()).onlyMine()).isEmpty();
        RivalSummaryResponse r = RivalSummaryCalculator.summarize(1L, "a", shared);
        assertThat(r.totals().sharedCount()).isZero();
        assertThat(r.patterns()).allSatisfy(p -> assertThat(p.sharedCount()).isZero());
    }

    // ---------- 속성별·서열 난이도별 집계 ----------

    @Test
    void 속성별로_승무패_접전을_달성률_차로_세고_점수차합계는_옛_필드로_남는다() {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        // 삼중: 내 95.00/상대 90.00(+5.00 승), 내 89.50/상대 90.00(-0.50 패·접전), 내 85.00/상대 85.00(0.00 무·접전)
        add(mine, theirs, 1, PatternType.TRIPLE, "5.6", "205.00", "200.00", "95.00", "90.00");
        add(mine, theirs, 2, PatternType.TRIPLE, "5.6", "199.50", "200.00", "89.50", "90.00");
        add(mine, theirs, 3, PatternType.TRIPLE, "5.7", "210.00", "210.00", "85.00", "85.00");
        // 단일: 내 80.00/상대 90.00(-10.00 패)
        add(mine, theirs, 4, PatternType.SINGLE, "5.7", "190.00", "200.00", "80.00", "90.00");

        RivalSummaryResponse r = RivalSummaryCalculator.summarize(1L, "a", RivalSummaryCalculator.share(mine, theirs));

        RivalSummaryResponse.PatternSummary triple = pattern(r, "TRIPLE");
        assertThat(triple.wins()).isEqualTo(1);
        assertThat(triple.losses()).isEqualTo(1);
        assertThat(triple.ties()).isEqualTo(1);
        assertThat(triple.closeCount()).isEqualTo(2);
        assertThat(triple.sharedCount()).isEqualTo(3);
        assertThat(triple.rateDiffAvg()).isEqualByComparingTo("1.5");        // (5.00 - 0.50 + 0.00) / 3
        assertThat(triple.scoreDiffSum()).isEqualByComparingTo("4.50");      // 옛 필드: 점수 차 합계
        RivalSummaryResponse.PatternSummary single = pattern(r, "SINGLE");
        assertThat(single.losses()).isEqualTo(1);
        assertThat(single.scoreDiffSum()).isEqualByComparingTo("-10.00");

        assertThat(r.totals().sharedCount()).isEqualTo(4);
        assertThat(r.totals().wins()).isEqualTo(1);
        assertThat(r.totals().losses()).isEqualTo(2);
        assertThat(r.totals().scoreDiffSum()).isEqualByComparingTo("-5.50");
        // 서열 난이도별: 높은 난이도 먼저. 5.7에는 삼중 무 1과 단일 패 1
        assertThat(r.tiers()).extracting(RivalSummaryResponse.TierSummary::tier).containsExactly(d("5.7"), d("5.6"));
        RivalSummaryResponse.TierSummary t57 = r.tiers().get(0);
        assertThat(t57.ties()).isEqualTo(1);
        assertThat(t57.losses()).isEqualTo(1);
        // 분포: 속성별 작은 값부터, 곡 id 없음. 점수 차(옛)와 달성률 차(새) 둘 다
        assertThat(r.distribution().stream().filter(p -> p.key().equals("TRIPLE")).findFirst().orElseThrow().diffs())
                .containsExactly(d("-0.50"), d("0.00"), d("5.00"));
        assertThat(r.rateDistribution().stream().filter(p -> p.key().equals("TRIPLE")).findFirst().orElseThrow().diffs())
                .containsExactly(d("-0.50"), d("0.00"), d("5.00"));
        assertThat(r.rateDistribution().stream().filter(p -> p.key().equals("SINGLE")).findFirst().orElseThrow().diffs())
                .containsExactly(d("-10.00"));
    }

    @Test
    void 한쪽만_기록한_곡은_승무패_평균에_넣지_않고_속성별_곡_수로만_센다() {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        // 공유 1곡: 내 95.00/상대 90.00(+5.00 승)
        add(mine, theirs, 1, PatternType.SINGLE, "5.6", "205.00", "200.00", "95.00", "90.00");
        // 상대만 3곡(단일 2, 삼중 1), 나만 2곡(단일 1, 이중 1)
        theirs.add(rateChart(10, PatternType.SINGLE, "5.6", "70.00"));
        theirs.add(rateChart(11, PatternType.SINGLE, "5.6", "99.00"));
        theirs.add(rateChart(12, PatternType.TRIPLE, "5.6", "60.00"));
        mine.add(rateChart(20, PatternType.SINGLE, "5.6", "50.00"));
        mine.add(rateChart(21, PatternType.DOUBLE, "5.6", "40.00"));
        // 레이팅 제외 속성은 어느 쪽에도 세지 않는다
        theirs.add(rateChart(30, PatternType.EXCLUDED, "5.6", "80.00"));

        RivalSummaryResponse r = RivalSummaryCalculator.summarize(1L, "a", RivalSummaryCalculator.share(mine, theirs),
                RivalSummaryCalculator.unmatched(mine, theirs));

        RivalSummaryResponse.PatternSummary single = pattern(r, "SINGLE");
        assertThat(single.onlyTheirs()).isEqualTo(2);
        assertThat(single.onlyMine()).isEqualTo(1);
        assertThat(single.sharedCount()).isEqualTo(1);       // 승·무·패·평균은 공유 1곡만
        assertThat(single.wins()).isEqualTo(1);
        assertThat(single.ties()).isZero();
        assertThat(single.losses()).isZero();
        assertThat(single.rateDiffAvg()).isEqualByComparingTo("5.0");
        assertThat(pattern(r, "TRIPLE").onlyTheirs()).isEqualTo(1);
        assertThat(pattern(r, "TRIPLE").sharedCount()).isZero();
        assertThat(pattern(r, "TRIPLE").rateDiffAvg()).isNull();   // 0%로 보지 않는다
        assertThat(pattern(r, "DOUBLE").onlyMine()).isEqualTo(1);
        assertThat(pattern(r, "COMPOUND").onlyTheirs()).isZero();
        assertThat(r.patterns().stream().mapToInt(RivalSummaryResponse.PatternSummary::onlyTheirs).sum()).isEqualTo(3);
        assertThat(r.patterns().stream().mapToInt(RivalSummaryResponse.PatternSummary::onlyMine).sum()).isEqualTo(2);
        assertThat(r.totals().sharedCount()).isEqualTo(1);
    }

    @Test
    void 한쪽_기록이_전무하면_공유_곡은_0이고_상대만_곡_수만_남는다() {
        List<SkillService.ScoredChart> theirs = List.of(rateChart(1, PatternType.SINGLE, "5.6", "90.00"), rateChart(2, PatternType.SINGLE, "5.6", "91.00"));
        RivalSummaryResponse r = RivalSummaryCalculator.summarize(1L, "a", RivalSummaryCalculator.share(List.of(), theirs),
                RivalSummaryCalculator.unmatched(List.of(), theirs));
        RivalSummaryResponse.PatternSummary single = pattern(r, "SINGLE");
        assertThat(single.sharedCount()).isZero();
        assertThat(single.onlyTheirs()).isEqualTo(2);
        assertThat(single.onlyMine()).isZero();
        assertThat(single.wins() + single.ties() + single.losses()).isZero();
        assertThat(single.rateDiffAvg()).isNull();
    }

    @Test
    void 같은_난이도가_다른_자릿수로_들어와도_한_줄이다() {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        add(mine, theirs, 1, PatternType.SINGLE, "5.6", "100.00", "90.00", "90.00", "85.00");
        add(mine, theirs, 2, PatternType.SINGLE, "5.60", "100.00", "90.00", "90.00", "85.00");
        assertThat(RivalSummaryCalculator.summarize(1L, "a", RivalSummaryCalculator.share(mine, theirs)).tiers()).hasSize(1);
    }

    private static void add(List<SkillService.ScoredChart> mine, List<SkillService.ScoredChart> theirs, long id,
                            PatternType pattern, String tier, String myScore, String theirScore, String myRate, String theirRate) {
        mine.add(chart(id, pattern, tier, myScore, myRate));
        theirs.add(chart(id, pattern, tier, theirScore, theirRate));
    }

    /** 달성률 차만 중요한 테스트용: 내 달성률 / 상대 달성률. */
    private static void addRates(List<SkillService.ScoredChart> mine, List<SkillService.ScoredChart> theirs, long id,
                                 PatternType pattern, String myRate, String theirRate) {
        mine.add(rateChart(id, pattern, "5.6", myRate));
        theirs.add(rateChart(id, pattern, "5.6", theirRate));
    }

    private static RivalSummaryResponse.PatternSummary pattern(RivalSummaryResponse r, String key) {
        return r.patterns().stream().filter(p -> p.key().equals(key)).findFirst().orElseThrow();
    }

    // ---------- 곡 목록: 필터·정렬·요청 값 ----------

    @Test
    void 필터는_열세_접전_우세로_가르고_곡_수를_센다() {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        addRates(mine, theirs, 1, PatternType.COMPOUND, "95.00", "90.00");   // +5.00
        addRates(mine, theirs, 2, PatternType.COMPOUND, "89.50", "90.00");   // -0.50
        addRates(mine, theirs, 3, PatternType.COMPOUND, "90.00", "90.00");   //  0.00
        addRates(mine, theirs, 4, PatternType.COMPOUND, "80.00", "90.00");   // -10.00
        List<RivalSummaryCalculator.Shared> rows = RivalSummaryCalculator.share(mine, theirs);

        RivalSummaryDetailResponse.FilterCounts counts = RivalSummaryCalculator.filterCounts(rows);
        assertThat(counts.all()).isEqualTo(4);
        assertThat(counts.lose()).isEqualTo(2);
        assertThat(counts.close()).isEqualTo(2);
        assertThat(counts.win()).isEqualTo(1);
        assertThat(rows.stream().filter(s -> RivalSummaryCalculator.matches(RivalSummaryCalculator.Filter.LOSE, s)).count()).isEqualTo(2);
    }

    @Test
    void 정렬은_차이_오름_내림_절댓값_곡명이고_같으면_레벨_높은_순_채보_id_순이다() {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        // 점수는 모두 같게(달성률 95%부터 점수가 같아진다) 두어도 정렬은 달성률 차 기준이다
        add(mine, theirs, 1, PatternType.COMPOUND, "5.6", "304.00", "304.00", "99.00", "96.00");   // +3.00
        add(mine, theirs, 2, PatternType.COMPOUND, "5.6", "304.00", "304.00", "97.50", "98.00");   // -0.50
        add(mine, theirs, 3, PatternType.COMPOUND, "5.6", "304.00", "304.00", "96.00", "99.80");   // -3.80
        List<RivalSummaryCalculator.Shared> rows = RivalSummaryCalculator.share(mine, theirs);

        assertThat(ids(rows, RivalSummaryCalculator.Sort.DIFF_ASC)).containsExactly(3L, 2L, 1L);
        assertThat(ids(rows, RivalSummaryCalculator.Sort.DIFF_DESC)).containsExactly(1L, 2L, 3L);
        assertThat(ids(rows, RivalSummaryCalculator.Sort.CLOSE)).containsExactly(2L, 1L, 3L);   // |-0.50| < |+3.00| < |-3.80|
        assertThat(ids(rows, RivalSummaryCalculator.Sort.TITLE)).containsExactly(1L, 2L, 3L);
    }

    private static List<Long> ids(List<RivalSummaryCalculator.Shared> rows, RivalSummaryCalculator.Sort sort) {
        return rows.stream().sorted(RivalSummaryCalculator.comparator(sort)).map(s -> s.chart().songDifficultyId()).toList();
    }

    @Test
    void 정렬을_안_정하면_필터에_맞는_기본을_쓴다() {
        assertThat(RivalSummaryCalculator.defaultSort(RivalSummaryCalculator.Filter.ALL)).isEqualTo(RivalSummaryCalculator.Sort.DIFF_ASC);
        assertThat(RivalSummaryCalculator.defaultSort(RivalSummaryCalculator.Filter.LOSE)).isEqualTo(RivalSummaryCalculator.Sort.DIFF_ASC);
        assertThat(RivalSummaryCalculator.defaultSort(RivalSummaryCalculator.Filter.WIN)).isEqualTo(RivalSummaryCalculator.Sort.DIFF_DESC);
        assertThat(RivalSummaryCalculator.defaultSort(RivalSummaryCalculator.Filter.CLOSE)).isEqualTo(RivalSummaryCalculator.Sort.CLOSE);
    }

    @Test
    void 요청_값은_화이트리스트로만_해석한다() {
        assertThat(RivalSummaryCalculator.parsePattern("composite_single")).isEqualTo(PatternType.COMPOSITE_SINGLE);
        assertThat(Stream.of("SINGLE", "COMPOUND", "COMPOSITE_SINGLE", "DOUBLE", "TRIPLE").map(RivalSummaryCalculator::parsePattern))
                .doesNotContainNull();
        assertThat(RivalSummaryCalculator.parsePattern("EXCLUDED")).isNull();     // 레이팅 제외는 집계 대상이 아니다
        assertThat(RivalSummaryCalculator.parsePattern("1 OR 1=1")).isNull();
        assertThat(RivalSummaryCalculator.parsePattern(null)).isNull();

        assertThat(RivalSummaryCalculator.parseFilter(null)).isEqualTo(RivalSummaryCalculator.Filter.ALL);
        assertThat(RivalSummaryCalculator.parseFilter(" ")).isEqualTo(RivalSummaryCalculator.Filter.ALL);
        assertThat(RivalSummaryCalculator.parseFilter("close")).isEqualTo(RivalSummaryCalculator.Filter.CLOSE);
        assertThat(RivalSummaryCalculator.parseFilter("losing")).isNull();

        assertThat(RivalSummaryCalculator.parseSort("diff_asc")).isEqualTo(RivalSummaryCalculator.Sort.DIFF_ASC);
        assertThat(RivalSummaryCalculator.parseSort("title; DROP TABLE users")).isNull();
        assertThat(RivalSummaryCalculator.parseSort(null)).isNull();
    }

    @Test
    void 줄에는_양쪽_기록과_차이가_들어간다() {
        RivalSummaryCalculator.Shared s = RivalSummaryCalculator.share(
                List.of(chart(1, PatternType.COMPOSITE_SINGLE, "5.6", "238.10", "96.00")),
                List.of(chart(1, PatternType.COMPOSITE_SINGLE, "5.6", "235.82", "94.50"))).get(0);
        RivalSummaryDetailResponse.Row row = RivalSummaryCalculator.toRow(s);
        assertThat(row.pattern()).isEqualTo("복합(단일)");
        assertThat(row.score()).isEqualByComparingTo("235.82");
        assertThat(row.myScore()).isEqualByComparingTo("238.10");
        assertThat(row.diff()).isEqualByComparingTo("2.28");          // 옛 필드: 점수 차
        assertThat(row.rateDiff()).isEqualByComparingTo("1.50");      // 판정·정렬 기준: 달성률 차
        assertThat(row.myRate()).isEqualByComparingTo("96.00");
        assertThat(row.rate()).isEqualByComparingTo("94.50");
        assertThat(row.songDifficultyId()).isEqualTo(1L);
        assertThat(row.tier()).isEqualByComparingTo("5.6");
    }

    // ---------- 속성별 달성률 차 평균(%p, D67 개정) ----------

    private static SkillService.ScoredChart rated(long id, PatternType pattern, String score, String rate) {
        RatingCandidate c = new RatingCandidate(id, 100 + id, "곡" + id, "GUITAR", "MASTER", d("9.50"), d("5.6"), pattern.getLabel(),
                d(rate), false, null);
        return new SkillService.ScoredChart(c, pattern, d(score));
    }

    /** 속성 하나에 곡 여러 개: 곡마다 {내 달성률, 상대 달성률}. 점수는 같게 두어 점수 차(옛 필드)가 0임을 함께 확인한다. */
    private static RivalSummaryResponse.PatternSummary rateAvg(PatternType pattern, String[]... ratePairs) {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        long id = 1;
        for (String[] pair : ratePairs) {
            mine.add(rated(id, pattern, "200.00", pair[0]));
            theirs.add(rated(id, pattern, "200.00", pair[1]));
            id++;
        }
        RivalSummaryResponse r = RivalSummaryCalculator.summarize(1L, "a", RivalSummaryCalculator.share(mine, theirs));
        return pattern(r, pattern.name());
    }

    @Test
    void 달성률_차_평균은_공유_곡마다_내_달성률_빼기_상대_달성률의_산술평균이다() {
        // 내 96.00/상대 94.00(+2.00), 내 80.00/상대 84.00(-4.00) -> 평균 -1.0%p
        assertThat(rateAvg(PatternType.SINGLE, new String[] {"96.00", "94.00"}, new String[] {"80.00", "84.00"}).rateDiffAvg())
                .isEqualByComparingTo("-1.0");
        // 앞서는 경우: +2.00, +1.60 -> +1.8%p
        assertThat(rateAvg(PatternType.TRIPLE, new String[] {"96.00", "94.00"}, new String[] {"91.60", "90.00"}).rateDiffAvg())
                .isEqualByComparingTo("1.8");
        // 같으면 0.0
        assertThat(rateAvg(PatternType.DOUBLE, new String[] {"90.00", "90.00"}).rateDiffAvg()).isEqualByComparingTo("0.0");
    }

    @Test
    void 달성률_차_평균은_평균을_낸_뒤_한_번만_소수_첫째_자리로_반올림한다() {
        // 합 1.00 / 3곡 = 0.3333 -> 0.3
        assertThat(rateAvg(PatternType.SINGLE, new String[] {"91.00", "90.00"}, new String[] {"90.00", "90.00"}, new String[] {"90.00", "90.00"}).rateDiffAvg())
                .isEqualByComparingTo("0.3");
        // 절반은 0에서 먼 쪽: +0.05 -> +0.1, -0.05 -> -0.1, +0.04 -> 0.0, -0.04 -> 0.0
        assertThat(rateAvg(PatternType.SINGLE, new String[] {"90.05", "90.00"}).rateDiffAvg()).isEqualByComparingTo("0.1");
        assertThat(rateAvg(PatternType.SINGLE, new String[] {"89.95", "90.00"}).rateDiffAvg()).isEqualByComparingTo("-0.1");
        assertThat(rateAvg(PatternType.SINGLE, new String[] {"90.04", "90.00"}).rateDiffAvg()).isEqualByComparingTo("0.0");
        assertThat(rateAvg(PatternType.SINGLE, new String[] {"89.96", "90.00"}).rateDiffAvg()).isEqualByComparingTo("0.0");
    }

    @Test
    void 점수가_같아도_달성률이_다르면_달성률로_판정한다_평균과_판정이_같은_값에서_나온다() {
        // 점수는 같다(200.00 대 200.00). 달성률은 내 96.00/상대 97.50이라 평균 -1.5%p이고 판정도 패다(접전이 아니다: |-1.50| > 1.00).
        RivalSummaryResponse.PatternSummary p = rateAvg(PatternType.SINGLE, new String[] {"96.00", "97.50"});
        assertThat(p.losses()).isEqualTo(1);
        assertThat(p.ties()).isZero();
        assertThat(p.wins()).isZero();
        assertThat(p.closeCount()).isZero();
        assertThat(p.scoreDiffSum()).isEqualByComparingTo("0.00");   // 옛 필드는 점수 차 그대로
        assertThat(p.rateDiffAvg()).isEqualByComparingTo("-1.5");
    }

    @Test
    void 공유_곡이_없는_속성의_달성률_차_평균은_null이다_0이_아니다() {
        RivalSummaryResponse r = RivalSummaryCalculator.summarize(1L, "a", List.of());
        assertThat(r.patterns()).allSatisfy(p -> assertThat(p.rateDiffAvg()).isNull());
        // 한쪽만 기록한 속성도 공유 곡이 없으므로 null
        RivalSummaryResponse r2 = RivalSummaryCalculator.summarize(1L, "a",
                RivalSummaryCalculator.share(List.of(rated(1, PatternType.SINGLE, "100.00", "90.00")), List.of(rated(2, PatternType.SINGLE, "100.00", "90.00"))));
        assertThat(pattern(r2, "SINGLE").rateDiffAvg()).isNull();
    }
}
