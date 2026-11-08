package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/**
 * 채보 한 개의 서열표 값 + 내 최고 달성률 (SkillMapper.findChartRating 결과).
 * entryId가 null이면 레이팅 서열표에 없는 채보다. 속성(pattern)은 한글 라벨 그대로 받는다(RatingCandidate와 같음).
 */
public record ChartRatingRow(Long entryId, BigDecimal tier, String pattern, Boolean ratingEnabled, BigDecimal bestRate) {
}
