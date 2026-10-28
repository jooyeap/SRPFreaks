package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/** 상승 예상 점수 계산에 필요한 채보의 서열표 값(기준 난이도, 속성 라벨). */
public record PeerChartMeta(Long songDifficultyId, BigDecimal tier, String pattern) {
}
