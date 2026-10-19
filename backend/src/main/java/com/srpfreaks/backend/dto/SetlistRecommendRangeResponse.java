package com.srpfreaks.backend.dto;

import java.math.BigDecimal;

/** 저장된 추천 범위(평균 난이도 대비 차이). */
public record SetlistRecommendRangeResponse(BigDecimal ssMin, BigDecimal ssMax, BigDecimal sMin, BigDecimal sMax) {
}
