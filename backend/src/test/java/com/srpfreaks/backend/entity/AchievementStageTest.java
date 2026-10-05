package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class AchievementStageTest {

    private static BigDecimal r(String v) {
        return new BigDecimal(v);
    }

    @Test
    void 달성률_구간별_단계() {
        assertThat(AchievementStage.of(r("0.00"), false)).isEqualTo(AchievementStage.C);
        assertThat(AchievementStage.of(r("62.99"), false)).isEqualTo(AchievementStage.C);
        assertThat(AchievementStage.of(r("63.00"), false)).isEqualTo(AchievementStage.B);
        assertThat(AchievementStage.of(r("72.99"), false)).isEqualTo(AchievementStage.B);
        assertThat(AchievementStage.of(r("73.00"), false)).isEqualTo(AchievementStage.A);
        assertThat(AchievementStage.of(r("79.99"), false)).isEqualTo(AchievementStage.A);
        assertThat(AchievementStage.of(r("80.00"), false)).isEqualTo(AchievementStage.S);
        assertThat(AchievementStage.of(r("94.99"), false)).isEqualTo(AchievementStage.S);
        assertThat(AchievementStage.of(r("95.00"), false)).isEqualTo(AchievementStage.SS);
        assertThat(AchievementStage.of(r("99.99"), false)).isEqualTo(AchievementStage.SS);
        assertThat(AchievementStage.of(r("100.00"), false)).isEqualTo(AchievementStage.EXC);
    }

    @Test
    void FC는_달성률과_별개로_가장_높은_단계가_된다() {
        // 96%이면서 FC면 FC만 표시한다 (DESIGN-UI 2장)
        assertThat(AchievementStage.of(r("96.00"), true)).isEqualTo(AchievementStage.FC);
        // 낮은 달성률이어도 FC면 FC 단계다 (FC 판정이 달성률 구간보다 먼저)
        assertThat(AchievementStage.of(r("70.00"), true)).isEqualTo(AchievementStage.FC);
        // 100.00은 FC가 아니라 EXC
        assertThat(AchievementStage.of(r("100.00"), true)).isEqualTo(AchievementStage.EXC);
    }

    @Test
    void 단계_선언_순서가_낮은_단계에서_높은_단계다() {
        assertThat(AchievementStage.values())
                .containsExactly(AchievementStage.C, AchievementStage.B, AchievementStage.A, AchievementStage.S,
                        AchievementStage.SS, AchievementStage.FC, AchievementStage.EXC);
        assertThat(AchievementStage.FC).isGreaterThan(AchievementStage.SS);
    }

    @Test
    void 기록이_없으면_null() {
        assertThat(AchievementStage.of(null, false)).isNull();
    }
}
