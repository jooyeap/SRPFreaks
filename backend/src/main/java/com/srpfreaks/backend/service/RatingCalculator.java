package com.srpfreaks.backend.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 레이팅 수식 (docs/DESIGN.md 7장, D18). 상태가 없는 순수 계산이라 DB 없이 테스트한다.
 * 숫자(80, 95, 3.2, 20, 기준점 6.0 ...)는 RatingConfig에서 오고, 수식의 모양만 여기에 있다.
 * 계산은 BigDecimal로 한다. double을 쓰면 0.1 같은 값이 이진수로 어긋나 경계(예: 점수 합계 정수부)가 틀어질 수 있다.
 */
public class RatingCalculator {

    /** 나눗셈 중간 결과의 자릿수. 마지막에 점수를 2자리로 반올림하므로 넉넉하게 둔다. */
    private static final int SCALE = 10;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final RatingConfig config;

    public RatingCalculator(RatingConfig config) {
        this.config = config;
    }

    /**
     * 레이팅상수 R. 기준 난이도 T가 기준점(6.0)보다 크면 5T-15, 아니면 10T-45.
     * (T=7.0 -> 20, 6.5 -> 17.5, 6.0 -> 15, 5.9 -> 14, 5.0 -> 5)
     */
    public BigDecimal constant(BigDecimal tier) {
        if (tier.compareTo(config.pivot()) > 0) {
            return config.highSlope().multiply(tier).subtract(config.highOffset());
        }
        return config.lowSlope().multiply(tier).subtract(config.lowOffset());
    }

    /**
     * 채보 값 V = R x min(A,80)/100 + 3.2 x min(max(A-80,0), 15)/15  (A = 달성률, 15 = 95-80).
     * 80%까지는 선형, 80~95%는 최대 +3.2가 더해지고 95% 이상은 더 오르지 않는다.
     */
    public BigDecimal value(BigDecimal constant, BigDecimal rate) {
        BigDecimal cap = config.capRate();
        BigDecimal span = config.maxRate().subtract(cap);

        BigDecimal base = constant.multiply(rate.min(cap)).divide(HUNDRED, SCALE, RoundingMode.HALF_UP);
        BigDecimal over = rate.subtract(cap).max(BigDecimal.ZERO).min(span);
        BigDecimal bonus = config.bonus().multiply(over).divide(span, SCALE, RoundingMode.HALF_UP);
        return base.add(bonus);
    }

    /**
     * 점수 = V x 20. 반올림하지 않은 값이다 (D20: 계산은 소수 그대로).
     * 합계도 이 값들의 합으로 구하고, 티어 판정에도 이 값을 쓴다. 반올림은 화면에 내보낼 때만 한다(display).
     */
    public BigDecimal score(BigDecimal value) {
        return value.multiply(config.scoreMultiplier());
    }

    /** 화면 표시용: 소수 둘째 자리까지 반올림(HALF_UP). */
    public static BigDecimal display(BigDecimal exact) {
        return exact.setScale(2, RoundingMode.HALF_UP);
    }
}
