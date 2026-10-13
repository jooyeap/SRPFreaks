package com.srpfreaks.backend.entity;

import java.math.BigDecimal;

/**
 * 달성 단계. C < B < A < S < SS < FC < EXC 중 가장 높은 하나만 쓴다. 저장하지 않고 달성률과 FC 여부로 계산한다 (D9, D24).
 * 판정 순서: EXC(100.00) -> FC(is_full_combo) -> SS(95 이상) -> S(80 이상) -> A(73 이상) -> B(63 이상) -> C(63 미만).
 * 기록이 있으면 항상 단계가 하나 생기고, 기록이 없을 때만 null이다.
 * 선언 순서가 낮은 단계 -> 높은 단계이므로 compareTo로 높낮이를 비교할 수 있다.
 */
public enum AchievementStage {
    C, B, A, S, SS, FC, EXC;

    private static final BigDecimal EXC_RATE = new BigDecimal("100.00");
    private static final BigDecimal SS_RATE = new BigDecimal("95.00");
    private static final BigDecimal S_RATE = new BigDecimal("80.00");
    private static final BigDecimal A_RATE = new BigDecimal("73.00");
    private static final BigDecimal B_RATE = new BigDecimal("63.00");

    /** 기록이 없을 때(rate가 null)만 null. 기록이 있으면 C 이상이 항상 나온다. */
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
        if (rate.compareTo(A_RATE) >= 0) {
            return A;
        }
        if (rate.compareTo(B_RATE) >= 0) {
            return B;
        }
        return C;
    }
}
