package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/** 달성률 구간 경계: 아래값을 포함하고, 기록이 없으면 미플레이. */
class RateBucketTest {

    private static RateBucket of(String rate) {
        return RateBucket.of(new BigDecimal(rate));
    }

    @Test
    void 구간_경계는_아래값을_포함한다() {
        assertThat(of("100.00")).isEqualTo(RateBucket.R95);
        assertThat(of("95.00")).isEqualTo(RateBucket.R95);
        assertThat(of("94.99")).isEqualTo(RateBucket.R90);
        assertThat(of("90.00")).isEqualTo(RateBucket.R90);
        assertThat(of("89.99")).isEqualTo(RateBucket.R85);
        assertThat(of("85.00")).isEqualTo(RateBucket.R85);
        assertThat(of("84.99")).isEqualTo(RateBucket.R80);
        assertThat(of("80.00")).isEqualTo(RateBucket.R80);
        assertThat(of("79.99")).isEqualTo(RateBucket.R73);
        assertThat(of("73.00")).isEqualTo(RateBucket.R73);
        assertThat(of("72.99")).isEqualTo(RateBucket.BELOW);
    }

    @Test
    void 달성률_0은_기록이_있으므로_73_미만이다() {
        assertThat(of("0.00")).isEqualTo(RateBucket.BELOW);
    }

    @Test
    void 기록이_없으면_미플레이다() {
        assertThat(RateBucket.of(null)).isEqualTo(RateBucket.UNPLAYED);
    }

    @Test
    void 소수_자리_수가_달라도_같은_값이면_같은_구간이다() {
        // BigDecimal은 95.0과 95.00의 scale이 다르다. equals가 아니라 compareTo로 비교하는지 확인한다
        assertThat(RateBucket.of(new BigDecimal("95.0"))).isEqualTo(RateBucket.R95);
        assertThat(RateBucket.of(new BigDecimal("73"))).isEqualTo(RateBucket.R73);
    }

    @Test
    void 선언_순서는_표시_순서다() {
        assertThat(RateBucket.values()).containsExactly(
                RateBucket.R95, RateBucket.R90, RateBucket.R85, RateBucket.R80,
                RateBucket.R73, RateBucket.BELOW, RateBucket.UNPLAYED);
    }
}
