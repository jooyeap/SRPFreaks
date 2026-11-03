package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 서열표 변경 알림 후보 한 줄(로그 한 건 × 내가 기록한 채보). 기준 난이도는 감사 로그 JSON의 글자 그대로(null = 미정).
 * 시각은 DB의 UTC 값 그대로 받는다. 감사 로그의 행위자(actor)는 가져오지 않는다.
 */
public record TierAlertRow(Long auditLogId, LocalDateTime changedAt, Long songDifficultyId, String beforeTier,
                           String afterTier, BigDecimal myRate) {
}
