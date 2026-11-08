package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.NotRatedReason;
import com.srpfreaks.backend.entity.PatternType.RatingGroup;

import java.math.BigDecimal;

/**
 * 한 채보의 "내 레이팅 상태" (저장 결과 카드용). notRatedReason이 null이면 레이팅 대상이다(group에 그룹).
 * bestRate = 내 SRN+ 최고 달성률(없으면 null), score = 그 최고 기록의 점수(둘째 자리 표시값, 기준 난이도·기록이 없으면 null).
 */
public record ChartRating(NotRatedReason notRatedReason, RatingGroup group, BigDecimal bestRate, BigDecimal score) {
}
