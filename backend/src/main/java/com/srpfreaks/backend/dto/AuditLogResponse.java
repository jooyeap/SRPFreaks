package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.AuditLog;

import java.time.Instant;
import java.util.Map;

/**
 * 감사 로그 한 줄 (ROOT 전용 화면). 작업한 사람은 id와 닉네임만 내보낸다(이메일·Google ID는 넣지 않는다).
 * 작업한 사람이 탈퇴했으면 actorId·actorNickname이 null이다(D20).
 */
public record AuditLogResponse(Long id, Long actorId, String actorNickname, String action, String targetType,
                               String targetId, Map<String, Object> detail, Instant createdAt) {

    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(log.getId(),
                log.getActor() == null ? null : log.getActor().getId(),
                log.getActor() == null ? null : log.getActor().getNickname(),
                log.getAction(), log.getTargetType(), log.getTargetId(), log.getDetail(), log.getCreatedAt());
    }
}
