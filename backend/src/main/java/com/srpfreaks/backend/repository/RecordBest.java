package com.srpfreaks.backend.repository;

import java.math.BigDecimal;

/** 채보 하나에 대한 본인 기록의 최고 달성률과 FC 여부(여러 기록 중 하나라도 FC면 true). */
public record RecordBest(Long songDifficultyId, BigDecimal bestRate, boolean fullCombo) {

    /** JPQL 생성자 식에서 쓰는 생성자. sum(case...)는 Long으로 오므로 0보다 크면 FC로 본다. */
    public RecordBest(Long songDifficultyId, BigDecimal bestRate, Long fullComboCount) {
        this(songDifficultyId, bestRate, fullComboCount != null && fullComboCount > 0);
    }
}
