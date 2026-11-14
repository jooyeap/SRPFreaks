package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/** 채보 한 개의 이름과 서열표 기준 난이도(없으면 null = 미정). 기록이 없는 채보도 요약을 낼 수 있게 기록과 따로 읽는다. */
public record ChartInfoRow(Long songDifficultyId, Long songId, String title, String part, String difficulty, BigDecimal level,
                           BigDecimal tier) {
}
