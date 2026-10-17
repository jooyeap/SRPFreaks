package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/**
 * 세트리스트 추천 후보 한 줄 = 서열표의 채보 하나 + 내 SRN+ 최고 기록(없으면 bestRate, fullCombo가 null).
 * enum 컬럼(파트, 난이도)은 DB 값 그대로 문자열로 받고 서비스에서 enum으로 바꾼다(RatingCandidate와 같은 방식).
 * 기록이 없는 채보도 후보라서 LEFT JOIN 결과를 받는다 -> 원시 boolean이 아니라 Boolean.
 */
public record RecommendCandidate(Long songDifficultyId, Long songId, String title, String part, String difficulty,
                                 BigDecimal level, BigDecimal tier, BigDecimal bestRate, Boolean fullCombo) {
}
