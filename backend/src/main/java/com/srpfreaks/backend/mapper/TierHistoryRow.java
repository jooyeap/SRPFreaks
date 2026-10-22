package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 서열표 변경 이력 한 줄(audit_logs 한 건 + 그 채보). 추가(CREATE)면 before* 값이 모두 null이다.
 * 값은 감사 로그의 JSON 값을 SQL의 JSON_VALUE로 꺼낸 것이라(JSON null은 SQL NULL) 문자열로 받고 서비스에서 숫자로 바꾼다.
 * 감사 로그의 행위자(actor)는 일부러 가져오지 않는다. 화면에 누가 바꿨는지 내보내지 않기 위해서다.
 * 시각은 DB의 UTC 값을 그대로 받으려고 LocalDateTime이다(서비스가 UTC로 해석해 Instant로 바꾼다).
 */
public record TierHistoryRow(String action, LocalDateTime changedAt, Long songDifficultyId, String part, String difficulty,
                             BigDecimal level, String beforeTier, String afterTier, String beforePattern,
                             String afterPattern) {
}
