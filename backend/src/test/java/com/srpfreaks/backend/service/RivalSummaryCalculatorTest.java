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

/** 라이벌 대시보드 집계의 순수 계산(D67). 승/무/패/접전 경계(±1.00, ±1.01), 표시값 기준 차이, 속성·서열 난이도 집계. */
class RivalSummaryCalculatorTest {

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    /** 채보 하나의 점수만 중요하다(달성률은 표시용). */
    private static SkillService.ScoredChart chart(long id, PatternType pattern, String tier, String score) {
        RatingCandidate c = new RatingCandidate(id, 100 + id, "곡" + id, "GUITAR", "MASTER", d("9.50"), d(tier), pattern.getLabel(),
                d("90.00"), false, null);
        return new SkillService.ScoredChart(c, pattern, d(score));
    }

    private static List<RivalSummaryCalculator.Shared> shared(PatternType pattern, String mine, String theirs) {
        return RivalSummaryCalculator.share(List.of(chart(1, pattern, "5.6", mine)), List.of(chart(1, pattern, "5.6", theirs)));
    }

    // ---------- 승/무/패/접전 경계 ----------

    @Test
    void 차이_양수는_승_음수는_패_0은_무() {
        assertThat(shared(PatternType.SINGLE, "200.01", "200.00").get(0).diff()).isEqualByComparingTo("0.01");
        assertThat(RivalSummaryCalculator.summarize(1L, "a", shared(PatternType.SINGLE, "200.01", "200.00")).totals().wins()).isEqualTo(1);
        assertThat(RivalSummaryCalculator.summarize(1L, "a", shared(PatternType.SINGLE, "200.00", "200.01")).totals().losses()).isEqualTo(1);
        RivalSummaryResponse tie = RivalSummaryCalculator.summarize(1L, "a", shared(PatternType.SINGLE, "200.00", "200.00"));
        assertThat(tie.totals().ties()).isEqualTo(1);
        assertThat(tie.totals().closeCount()).isEqualTo(1);   // 무도 접전에 든다
    }

    @Test
    void 접전은_차이_절댓값_1_00까지_경계_포함() {
        assertThat(isClose("201.00", "200.00")).isTrue();     // +1.00
        assertThat(isClose("199.00", "200.00")).isTrue();     // -1.00
        assertThat(isClose("201.01", "200.00")).isFalse();    // +1.01
        assertThat(isClose("198.99", "200.00")).isFalse();    // -1.01
        assertThat(isClose("200.00", "200.00")).isTrue();     // 0.00
    }

    private static boolean isClose(String mine, String theirs) {
        return shared(PatternType.DOUBLE, mine, theirs).get(0).isClose();
    }

    @Test
    void 차이는_표시_둘째_자리_값끼리_뺀다() {
        // 소수 그대로면 차이가 1.004지만 화면에 보이는 값(10.00 - 9.00)은 1.00이라 접전이다
        RivalSummaryCalculator.Shared s = shared(PatternType.TRIPLE, "10.004", "9.000").get(0);
        assertThat(s.myShown()).isEqualByComparingTo("10.00");
        assertThat(s.diff()).isEqualByComparingTo("1.00");
        assertThat(s.isClose()).isTrue();
        // 9.005는 HALF_UP으로 9.01이라 차이는 0.99
        assertThat(shared(PatternType.TRIPLE, "10.004", "9.005").get(0).diff()).isEqualByComparingTo("0.99");
        // 표시값이 같으면 정확한 값이 조금 달라도 무
        assertThat(shared(PatternType.TRIPLE, "304.001", "304.004").get(0).diff()).isEqualByComparingTo("0.00");
    }

    // ---------- 범위: 둘 다 기록이 있는 채보 ----------

    @Test
    void 한쪽만_기록한_채보는_세지_않는다() {
        List<SkillService.ScoredChart> mine = List.of(chart(1, PatternType.SINGLE, "5.6", "100.00"), chart(2, PatternType.SINGLE, "5.6", "50.00"));
        List<SkillService.ScoredChart> theirs = List.of(chart(1, PatternType.SINGLE, "5.6", "90.00"), chart(3, PatternType.SINGLE, "5.6", "80.00"));
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
        assertThat(r.closeMargin()).isEqualByComparingTo("1.00");
    }

    @Test
    void 레이팅_제외_속성은_집계에서_빠진다() {
        List<RivalSummaryCalculator.Shared> shared = shared(PatternType.EXCLUDED, "100.00", "50.00");
        RivalSummaryResponse r = RivalSummaryCalculator.summarize(1L, "a", shared);
        assertThat(r.totals().sharedCount()).isZero();
        assertThat(r.patterns()).allSatisfy(p -> assertThat(p.sharedCount()).isZero());
    }

    // ---------- 속성별·서열 난이도별 집계 ----------

    @Test
    void 속성별로_승무패_접전_점수차합계를_센다() {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        // 삼중: +5.00(승), -0.50(패·접전), 0.00(무·접전)
        add(mine, theirs, 1, PatternType.TRIPLE, "5.6", "205.00", "200.00");
        add(mine, theirs, 2, PatternType.TRIPLE, "5.6", "199.50", "200.00");
        add(mine, theirs, 3, PatternType.TRIPLE, "5.7", "210.00", "210.00");
        // 단일: -10.00(패)
        add(mine, theirs, 4, PatternType.SINGLE, "5.7", "190.00", "200.00");

        RivalSummaryResponse r = RivalSummaryCalculator.summarize(1L, "a", RivalSummaryCalculator.share(mine, theirs));

        RivalSummaryResponse.PatternSummary triple = pattern(r, "TRIPLE");
        assertThat(triple.wins()).isEqualTo(1);
        assertThat(triple.losses()).isEqualTo(1);
        assertThat(triple.ties()).isEqualTo(1);
        assertThat(triple.closeCount()).isEqualTo(2);
        assertThat(triple.sharedCount()).isEqualTo(3);
        assertThat(triple.scoreDiffSum()).isEqualByComparingTo("4.50");
        RivalSummaryResponse.PatternSummary single = pattern(r, "SINGLE");
        assertThat(single.losses()).isEqualTo(1);
        assertThat(single.scoreDiffSum()).isEqualByComparingTo("-10.00");

        assertThat(r.totals().sharedCount()).isEqualTo(4);
        assertThat(r.totals().wins()).isEqualTo(1);
        assertThat(r.totals().losses()).isEqualTo(2);
        assertThat(r.totals().scoreDiffSum()).isEqualByComparingTo("-5.50");
        // 서열 난이도별: 높은 난이도 먼저
        assertThat(r.tiers()).extracting(RivalSummaryResponse.TierSummary::tier).containsExactly(d("5.7"), d("5.6"));
        RivalSummaryResponse.TierSummary t57 = r.tiers().get(0);
        assertThat(t57.ties()).isEqualTo(1);
        assertThat(t57.losses()).isEqualTo(1);
        // 분포: 속성별 작은 값부터, 곡 id 없음
        assertThat(r.distribution().stream().filter(p -> p.key().equals("TRIPLE")).findFirst().orElseThrow().diffs())
                .containsExactly(d("-0.50"), d("0.00"), d("5.00"));
    }

    @Test
    void 같은_난이도가_다른_자릿수로_들어와도_한_줄이다() {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        add(mine, theirs, 1, PatternType.SINGLE, "5.6", "100.00", "90.00");
        add(mine, theirs, 2, PatternType.SINGLE, "5.60", "100.00", "90.00");
        assertThat(RivalSummaryCalculator.summarize(1L, "a", RivalSummaryCalculator.share(mine, theirs)).tiers()).hasSize(1);
    }

    private static void add(List<SkillService.ScoredChart> mine, List<SkillService.ScoredChart> theirs, long id,
                            PatternType pattern, String tier, String myScore, String theirScore) {
        mine.add(chart(id, pattern, tier, myScore));
        theirs.add(chart(id, pattern, tier, theirScore));
    }

    private static RivalSummaryResponse.PatternSummary pattern(RivalSummaryResponse r, String key) {
        return r.patterns().stream().filter(p -> p.key().equals(key)).findFirst().orElseThrow();
    }

    // ---------- 곡 목록: 필터·정렬·요청 값 ----------

    @Test
    void 필터는_열세_접전_우세로_가르고_곡_수를_센다() {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        add(mine, theirs, 1, PatternType.COMPOUND, "5.6", "205.00", "200.00");   // +5.00
        add(mine, theirs, 2, PatternType.COMPOUND, "5.6", "199.50", "200.00");   // -0.50
        add(mine, theirs, 3, PatternType.COMPOUND, "5.6", "200.00", "200.00");   //  0.00
        add(mine, theirs, 4, PatternType.COMPOUND, "5.6", "190.00", "200.00");   // -10.00
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
        add(mine, theirs, 1, PatternType.COMPOUND, "5.6", "205.00", "200.00");   // +5
        add(mine, theirs, 2, PatternType.COMPOUND, "5.6", "199.50", "200.00");   // -0.5
        add(mine, theirs, 3, PatternType.COMPOUND, "5.6", "190.00", "200.00");   // -10
        List<RivalSummaryCalculator.Shared> rows = RivalSummaryCalculator.share(mine, theirs);

        assertThat(ids(rows, RivalSummaryCalculator.Sort.DIFF_ASC)).containsExactly(3L, 2L, 1L);
        assertThat(ids(rows, RivalSummaryCalculator.Sort.DIFF_DESC)).containsExactly(1L, 2L, 3L);
        assertThat(ids(rows, RivalSummaryCalculator.Sort.CLOSE)).containsExactly(2L, 1L, 3L);
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
        RivalSummaryCalculator.Shared s = shared(PatternType.COMPOSITE_SINGLE, "238.10", "235.82").get(0);
        RivalSummaryDetailResponse.Row row = RivalSummaryCalculator.toRow(s);
        assertThat(row.pattern()).isEqualTo("복합(단일)");
        assertThat(row.score()).isEqualByComparingTo("235.82");
        assertThat(row.myScore()).isEqualByComparingTo("238.10");
        assertThat(row.diff()).isEqualByComparingTo("2.28");
        assertThat(row.songDifficultyId()).isEqualTo(1L);
        assertThat(row.tier()).isEqualByComparingTo("5.6");
    }
}
