package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.AchievementStage;

import java.math.BigDecimal;

/**
 * 곡 상세의 라이벌 기록 한 줄(D56). rate = 상대 기록(없으면 null), diff = 내 기록 - 상대 기록(둘 중 하나라도 없으면 null).
 * stage = 상대 기록의 달성 단계(D65, 기록이 없으면 null). 응답에 추가된 필드라 기존 클라이언트는 무시해도 된다.
 */
public record RivalRecordResponse(Long userId, String nickname, BigDecimal rate, BigDecimal diff, AchievementStage stage) {
}
