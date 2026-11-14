package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 서열표 분석(D77)의 채보별 공개 유저 한 줄. 닉네임은 유저 목록(D26)에서 이미 보이는 값이고, 이메일·역할·Google ID는 select 하지 않는다.
 * lastPlayedAt은 UTC로 저장된 played_at 그대로다(시각만 비교·표시하므로 LocalDateTime으로 받고 서비스가 Instant로 바꾼다).
 */
public record ChartPlayerRow(Long userId, String nickname, BigDecimal bestRate, long playCount, LocalDateTime lastPlayedAt) {
}
