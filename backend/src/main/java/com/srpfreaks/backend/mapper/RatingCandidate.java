package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/**
 * 레이팅 후보 한 줄 = 본인이 기록을 남긴 채보 하나의 최고 달성률 + 서열표 값.
 * enum 컬럼(파트, 난이도, 속성)은 DB 값 그대로 문자열로 받고 서비스에서 enum으로 바꾼다
 * (속성은 한글 라벨로 저장돼 있어서 MyBatis 기본 enum 변환을 쓰지 않는다).
 */
public record RatingCandidate(Long songDifficultyId, Long songId, String title, String part, String difficulty,
                              BigDecimal level, BigDecimal tier, String pattern,
                              BigDecimal bestRate, boolean fullCombo) {
}
