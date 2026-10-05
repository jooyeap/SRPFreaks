package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.NoteOption;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/** 직접 손으로 계산한 값으로 수식을 검증한다(DESIGN.md 7장). 기본 설정: 기준점 6.0, 5T-15 / 10T-45, 80, 95, 3.2, x20. */
class RatingCalculatorTest {

    static RatingConfig defaults() {
        return new RatingConfig(bd("6.0"), bd("5"), bd("15"), bd("10"), bd("45"),
                bd("80"), bd("95"), bd("3.2"), bd("20"), 15, 25, NoteOption.SUPER_RANDOM_PLUS);
    }

    static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    private final RatingCalculator calc = new RatingCalculator(defaults());

    @Test
    void 레이팅상수는_기준점_6_0_전후로_식이_바뀐다() {
        assertThat(calc.constant(bd("7.0"))).isEqualByComparingTo("20");     // 5x7-15
        assertThat(calc.constant(bd("6.8"))).isEqualByComparingTo("19");     // 5x6.8-15
        assertThat(calc.constant(bd("6.5"))).isEqualByComparingTo("17.5");
        assertThat(calc.constant(bd("6.1"))).isEqualByComparingTo("15.5");   // 6.0 초과 -> 5T-15
        assertThat(calc.constant(bd("6.0"))).isEqualByComparingTo("15");     // 6.0 이하 -> 10T-45 (두 식이 만나는 점)
        assertThat(calc.constant(bd("5.9"))).isEqualByComparingTo("14");     // 10x5.9-45
        assertThat(calc.constant(bd("5.0"))).isEqualByComparingTo("5");
    }

    @Test
    void 채보_값은_80까지_선형이다() {
        BigDecimal r = bd("15");   // T=6.0
        assertThat(calc.value(r, bd("0.00"))).isEqualByComparingTo("0");
        assertThat(calc.value(r, bd("40.00"))).isEqualByComparingTo("6.0");   // 15 x 0.4
        assertThat(calc.value(r, bd("80.00"))).isEqualByComparingTo("12.0");  // 15 x 0.8
    }

    @Test
    void 채보_값은_80에서_95_사이에_최대_3_2가_더해진다() {
        BigDecimal r = bd("15");
        assertThat(calc.value(r, bd("87.50"))).isEqualByComparingTo("13.6");   // 12 + 3.2 x 7.5/15 = 12 + 1.6
        assertThat(calc.value(r, bd("95.00"))).isEqualByComparingTo("15.2");   // 12 + 3.2
    }

    @Test
    void 채보_값은_95_이상에서_더_오르지_않는다() {
        BigDecimal r = bd("15");
        assertThat(calc.value(r, bd("99.99"))).isEqualByComparingTo("15.2");
        assertThat(calc.value(r, bd("100.00"))).isEqualByComparingTo("15.2");
    }

    @Test
    void 기준_난이도가_다르면_같은_달성률도_값이_다르다() {
        // T=7.0 (R=20), A=95 -> 20x0.8 + 3.2 = 19.2
        assertThat(calc.value(calc.constant(bd("7.0")), bd("95.00"))).isEqualByComparingTo("19.2");
        // T=5.9 (R=14), A=95 -> 11.2 + 3.2 = 14.4
        assertThat(calc.value(calc.constant(bd("5.9")), bd("95.00"))).isEqualByComparingTo("14.4");
    }

    @Test
    void 점수는_V에_20을_곱한_값이고_반올림하지_않는다() {
        assertThat(calc.score(bd("15.2"))).isEqualByComparingTo("304");     // 달성률 95/100, T=6.0
        assertThat(calc.score(bd("12.0"))).isEqualByComparingTo("240");     // 달성률 80, T=6.0
        assertThat(calc.score(bd("13.6"))).isEqualByComparingTo("272");
        assertThat(calc.score(bd("13.6256"))).isEqualByComparingTo("272.512");   // 소수 그대로
    }

    @Test
    void 나누어떨어지지_않는_값도_소수_그대로_계산하고_표시할_때만_둘째_자리로_반올림한다() {
        // T=5.9 (R=14), A=91.37: 14x0.8 = 11.2, 3.2 x 11.37/15 = 2.4256 -> V=13.6256 -> x20 = 272.512
        BigDecimal v = calc.value(calc.constant(bd("5.9")), bd("91.37"));
        assertThat(v).isEqualByComparingTo("13.6256");
        assertThat(calc.score(v)).isEqualByComparingTo("272.512");
        assertThat(RatingCalculator.display(calc.score(v))).isEqualByComparingTo("272.51");
        assertThat(RatingCalculator.display(calc.score(v)).scale()).isEqualTo(2);

        // T=6.0, A=80.01: V = 12 + 3.2 x 0.01/15 = 12.00213333... -> x20 = 240.0426666... -> 표시 240.04
        assertThat(RatingCalculator.display(calc.score(calc.value(bd("15"), bd("80.01"))))).isEqualByComparingTo("240.04");
    }

    @Test
    void 표시_반올림은_HALF_UP이다() {
        assertThat(RatingCalculator.display(bd("272.505"))).isEqualByComparingTo("272.51");
        assertThat(RatingCalculator.display(bd("272.5049"))).isEqualByComparingTo("272.50");
        assertThat(RatingCalculator.display(bd("304"))).isEqualByComparingTo("304.00");
    }
}
