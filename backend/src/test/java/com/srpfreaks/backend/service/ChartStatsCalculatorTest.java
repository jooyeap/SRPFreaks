package com.srpfreaks.backend.service;

import com.srpfreaks.backend.service.ChartStatsCalculator.ChartAvg;
import com.srpfreaks.backend.service.ChartStatsCalculator.FolderStat;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;

/** 서열표 분석(D77)의 계산 정의를 직접 계산한 예시값으로 검증한다(DB 없이). */
class ChartStatsCalculatorTest {

    static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    static ChartAvg chart(long id, String tier, String avg) {
        return new ChartAvg(id, d(tier), avg == null ? null : d(avg));
    }

    // ---- 곡 평균 · 중앙값: 플레이어 3명 미만이면 null

    @Test
    void 플레이어_2명이면_평균과_중앙값이_null이다() {
        assertThat(ChartStatsCalculator.average(d("170.00"), 2)).isNull();
        assertThat(ChartStatsCalculator.median(List.of(d("80.00"), d("90.00")))).isNull();
    }

    @Test
    void 플레이어_3명이면_값이_나온다() {
        // 80.00 + 90.00 + 100.00 = 270.00, / 3 = 90.00
        assertThat(ChartStatsCalculator.average(d("270.00"), 3)).isEqualByComparingTo("90");
        assertThat(ChartStatsCalculator.median(List.of(d("100.00"), d("80.00"), d("90.00")))).isEqualByComparingTo("90");
    }

    @Test
    void 평균은_나눠떨어지지_않아도_반올림하지_않은_값으로_계산한다() {
        // 80 + 90 + 91 = 261 -> 87.0, 70 + 80 + 91 = 241 -> 80.333333...
        assertThat(ChartStatsCalculator.average(d("241.00"), 3)).isEqualByComparingTo("80.333333");
        // 화면에는 둘째 자리까지: 80.33
        assertThat(ChartStatsCalculator.display(ChartStatsCalculator.average(d("241.00"), 3))).isEqualByComparingTo("80.33");
    }

    @Test
    void 중앙값은_짝수_명이면_가운데_두_값의_평균이다() {
        // 70, 80, 90, 100 -> (80 + 90) / 2 = 85
        assertThat(ChartStatsCalculator.median(List.of(d("100"), d("70"), d("90"), d("80")))).isEqualByComparingTo("85");
        // 홀수 명이면 가운데 값: 60, 95, 99 -> 95 (평균은 84.67로 달라진다)
        assertThat(ChartStatsCalculator.median(List.of(d("99"), d("60"), d("95")))).isEqualByComparingTo("95");
    }

    // ---- 폴더 평균: 자기 곡 제외, 표본 부족 곡 제외, 곡마다 같은 비중, 3개 미만이면 null

    @Test
    void 폴더_평균은_자기_곡을_뺀_다른_곡들의_평균을_다시_평균한다() {
        // 폴더 6.0: A(자기)=95, B=80, C=90, D=70 -> 자기를 뺀 (80 + 90 + 70) / 3 = 80
        List<ChartAvg> folder = List.of(chart(1, "6.0", "95"), chart(2, "6.0", "80"), chart(3, "6.0", "90"), chart(4, "6.0", "70"));
        assertThat(ChartStatsCalculator.folderAverage(1L, folder)).isEqualByComparingTo("80");
        // 자기 곡 편차 = 95 - 80 = +15
        assertThat(ChartStatsCalculator.deviation(d("95"), ChartStatsCalculator.folderAverage(1L, folder))).isEqualByComparingTo("15");
    }

    @Test
    void 곡마다_같은_비중이라_플레이어가_많은_곡이_평균을_끌지_않는다() {
        // 플레이어 수와 상관없이 곡 평균끼리만 평균한다: (60 + 90 + 90) / 3 = 80 (플레이어 가중이면 달라질 값)
        List<ChartAvg> folder = List.of(chart(1, "6.0", "99"), chart(2, "6.0", "60"), chart(3, "6.0", "90"), chart(4, "6.0", "90"));
        assertThat(ChartStatsCalculator.folderAverage(1L, folder)).isEqualByComparingTo("80");
    }

    @Test
    void 표본_부족_곡은_폴더_평균에서_빠진다() {
        // B는 표본 부족(null). 자기를 뺀 표본 충분 곡은 C, D, E = 90, 80, 70 -> 80
        List<ChartAvg> folder = List.of(chart(1, "6.0", "95"), chart(2, "6.0", null), chart(3, "6.0", "90"),
                chart(4, "6.0", "80"), chart(5, "6.0", "70"));
        assertThat(ChartStatsCalculator.folderAverage(1L, folder)).isEqualByComparingTo("80");
    }

    @Test
    void 비교할_곡이_2개면_폴더_평균이_null이고_3개면_값이_나온다() {
        List<ChartAvg> two = List.of(chart(1, "6.0", "95"), chart(2, "6.0", "80"), chart(3, "6.0", "90"));
        assertThat(ChartStatsCalculator.folderAverage(1L, two)).isNull();
        assertThat(ChartStatsCalculator.deviation(d("95"), ChartStatsCalculator.folderAverage(1L, two))).isNull();

        List<ChartAvg> three = List.of(chart(1, "6.0", "95"), chart(2, "6.0", "80"), chart(3, "6.0", "90"), chart(4, "6.0", "70"));
        assertThat(ChartStatsCalculator.folderAverage(1L, three)).isEqualByComparingTo("80");
    }

    @Test
    void 자기_곡이_표본_부족이면_편차가_null이다() {
        List<ChartAvg> folder = List.of(chart(1, "6.0", null), chart(2, "6.0", "80"), chart(3, "6.0", "90"), chart(4, "6.0", "70"));
        BigDecimal folderAvg = ChartStatsCalculator.folderAverage(1L, folder);
        assertThat(folderAvg).isEqualByComparingTo("80");
        assertThat(ChartStatsCalculator.deviation(null, folderAvg)).isNull();
    }

    @Test
    void 편차는_마이너스가_될_수_있고_둘째_자리까지_표시한다() {
        // 예시 시안의 계산: 내 87.12 - 같은 티어 89.47 = -2.35
        assertThat(ChartStatsCalculator.display(ChartStatsCalculator.deviation(d("87.12"), d("89.47")))).isEqualByComparingTo("-2.35");
    }

    // ---- 폴더 곡선: 곡 수 · 평균 · 이전 폴더 대비 증감, 표본 부족 폴더는 건너뜀

    @Test
    void 폴더_곡선은_표본_부족_폴더를_건너뛰고_이전_표본_충분_폴더와_비교한다() {
        Map<BigDecimal, Integer> counts = new TreeMap<>();
        counts.put(d("5.8"), 4);
        counts.put(d("5.9"), 5);   // 표본 충분 곡이 2개뿐 -> 폴더 표본 부족
        counts.put(d("6.0"), 6);
        List<ChartAvg> charts = List.of(
                chart(1, "5.8", "90"), chart(2, "5.8", "80"), chart(3, "5.8", "70"),            // 평균 (90 + 80 + 70) / 3 = 80
                chart(4, "5.9", "88"), chart(5, "5.9", "84"), chart(6, "5.9", null),            // 표본 충분 2개 -> null
                chart(7, "6.0", "75"), chart(8, "6.0", "70"), chart(9, "6.0", "65"));           // 평균 70

        List<FolderStat> curve = ChartStatsCalculator.folderCurve(counts, charts);

        assertThat(curve).hasSize(3);
        assertThat(curve.get(0).tier()).isEqualByComparingTo("5.8");
        assertThat(curve.get(0).chartCount()).isEqualTo(4);
        assertThat(curve.get(0).sampledCharts()).isEqualTo(3);
        assertThat(curve.get(0).avg()).isEqualByComparingTo("80");
        assertThat(curve.get(0).delta()).isNull();                           // 첫 폴더는 비교할 이전이 없다
        assertThat(curve.get(1).avg()).isNull();                             // 5.9는 표본 부족
        assertThat(curve.get(1).delta()).isNull();
        assertThat(curve.get(2).avg()).isEqualByComparingTo("70");
        assertThat(curve.get(2).delta()).isEqualByComparingTo("-10");        // 5.9를 건너뛰고 5.8(80) 대비 -10
    }

    @Test
    void 기록이_없는_폴더도_곡_수와_함께_나온다() {
        Map<BigDecimal, Integer> counts = new TreeMap<>();
        counts.put(d("5.0"), 7);
        List<FolderStat> curve = ChartStatsCalculator.folderCurve(counts, List.of());
        assertThat(curve).hasSize(1);
        assertThat(curve.get(0).chartCount()).isEqualTo(7);
        assertThat(curve.get(0).sampledCharts()).isZero();
        assertThat(curve.get(0).avg()).isNull();
    }
}
