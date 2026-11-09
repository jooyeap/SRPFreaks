package com.srpfreaks.backend.repository;

import java.math.BigDecimal;

/**
 * 한 채보에 대한 한 사람의 최고 달성률(D56). fullCombo는 그 채보에 풀콤보 기록이 하나라도 있는지로, 곡 상세 라이벌 기록의
 * 달성 단계(D65)를 계산하는 데 쓴다. 단계는 다른 화면과 같이 `최고 달성률 + 풀콤보 여부`로 계산한다(`AchievementStage.of`).
 * 풀콤보를 읽지 않는 쿼리는 2개짜리 생성자를 쓴다(fullCombo = false).
 */
public record UserBest(Long userId, BigDecimal bestRate, boolean fullCombo) {

    public UserBest(Long userId, BigDecimal bestRate) {
        this(userId, bestRate, false);
    }

    /** JPQL 생성자 식용: `sum(case when r.fullCombo = true then 1L else 0L end)`가 Long으로 온다(RecordBest와 같은 방식). */
    public UserBest(Long userId, BigDecimal bestRate, Long fullComboCount) {
        this(userId, bestRate, fullComboCount != null && fullComboCount > 0);
    }
}
