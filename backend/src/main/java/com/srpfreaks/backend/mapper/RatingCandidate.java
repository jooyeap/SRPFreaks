package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 레이팅 후보 한 줄 = 본인이 기록을 남긴 채보 하나의 최고 달성률 + 서열표 값.
 * enum 컬럼(파트, 난이도, 속성)은 DB 값 그대로 문자열로 받고 서비스에서 enum으로 바꾼다
 * (속성은 한글 라벨로 저장돼 있어서 MyBatis 기본 enum 변환을 쓰지 않는다).
 *
 * achievedAt = 그 최고 달성률을 처음 기록한 플레이 시각(UTC로 저장된 값 그대로). 유저 목록의 동점 처리에만 쓴다(D26).
 * 시각끼리 순서만 비교하므로 시간대 변환이 필요 없는 LocalDateTime으로 받는다.
 */
public record RatingCandidate(Long songDifficultyId, Long songId, String title, String part, String difficulty,
                              BigDecimal level, BigDecimal tier, String pattern,
                              BigDecimal bestRate, boolean fullCombo, LocalDateTime achievedAt) {
}
