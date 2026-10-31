package com.srpfreaks.backend.dto;

import java.math.BigDecimal;

/** 곡 상세의 라이벌 기록 한 줄(D56). rate = 상대 기록(없으면 null), diff = 내 기록 - 상대 기록(둘 중 하나라도 없으면 null). */
public record RivalRecordResponse(Long userId, String nickname, BigDecimal rate, BigDecimal diff) {
}
