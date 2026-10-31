package com.srpfreaks.backend.repository;

import java.math.BigDecimal;

/** 한 사람의 한 채보 최고 달성률 + 채보 레벨(D56 라이벌 비교). */
public record ChartBest(Long songDifficultyId, BigDecimal bestRate, BigDecimal level) {
}
