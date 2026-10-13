package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class SkillSnapshotTest {

    private SkillSnapshot snapshot() {
        return SkillSnapshot.create(null, NoteOption.SUPER_RANDOM_PLUS, LocalDate.of(2026, 10, 10),
                new BigDecimal("100.50"), new BigDecimal("60.25"), new BigDecimal("40.25"));
    }

    @Test
    void 합계_단일_그외가_모두_같으면_변경_없음이다() {
        assertThat(snapshot().hasSameScores(new BigDecimal("100.50"), new BigDecimal("60.25"), new BigDecimal("40.25"))).isTrue();
    }

    @Test
    void 스케일이_달라도_값이_같으면_같다() {
        assertThat(snapshot().hasSameScores(new BigDecimal("100.5"), new BigDecimal("60.250"), new BigDecimal("40.25"))).isTrue();
    }

    @Test
    void 하나라도_다르면_변경이_있다() {
        assertThat(snapshot().hasSameScores(new BigDecimal("100.51"), new BigDecimal("60.25"), new BigDecimal("40.25"))).isFalse();
        // 합계는 같아도 소계가 달라졌다면 변경이다
        assertThat(snapshot().hasSameScores(new BigDecimal("100.50"), new BigDecimal("61.25"), new BigDecimal("39.25"))).isFalse();
    }
}
