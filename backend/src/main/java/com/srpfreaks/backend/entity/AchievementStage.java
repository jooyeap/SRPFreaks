package com.srpfreaks.backend.entity;

import java.math.BigDecimal;

/**
 * 달성 단계. S < SS < FC < EXC 중 가장 높은 하나만 쓴다. 저장하지 않고 달성률과 FC 여부로 계산한다 (D9).
 * 판정 순서: EXC(100.00) -> FC(is_full_combo) -> SS(95 이상) -> S(80 이상) -> 없음(null).
 */
public enum AchievementStage {
    S, SS, FC, EXC;

    private static final BigDecimal EXC_RATE = new BigDecimal("100.00");
    private static final BigDecimal SS_RATE = new BigDecimal("95.00");
    private static final BigDecimal S_RATE = new BigDecimal("80.00");

    /** 단계가 없으면(80 미만이면서 FC 아님) null. */
    public static AchievementStage of(BigDecimal rate, boolean fullCombo) {
        if (rate == null) {
            return null;
        }
        if (rate.compareTo(EXC_RATE) >= 0) {
            return EXC;
        }
        if (fullCombo) {
            return FC;
        }
        if (rate.compareTo(SS_RATE) >= 0) {
            return SS;
        }
        if (rate.compareTo(S_RATE) >= 0) {
            return S;
        }
        return null;
    }
}
