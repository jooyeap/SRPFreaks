package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/**
 * 관리 작업 기록. ROOT/ADMIN의 관리 작업(곡 등록, 서열표 수정, 설정 변경, 역할 변경 등)을 남긴다.
 * 쌓기만 하고 고치지 않으므로 setter/update 메서드가 없다. 작업한 사람이 탈퇴하면 actor가 NULL이 된다(D20).
 * detail에는 비밀번호·토큰·개인정보를 넣지 않는다.
 */
@Getter
@Entity
@Table(name = "audit_logs")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_log_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Column(name = "action", nullable = false, length = 50)
    private String action;

    @Column(name = "target_type", length = 50)
    private String targetType;

    @Column(name = "target_id", length = 64)
    private String targetId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail", columnDefinition = "json")
    private Map<String, Object> detail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    private AuditLog(User actor, String action, String targetType, String targetId, Map<String, Object> detail) {
        this.actor = actor;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.detail = detail;
    }

    public static AuditLog record(User actor, String action, String targetType, String targetId,
                                  Map<String, Object> detail) {
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("작업 종류는 비워 둘 수 없습니다.");
        }
        return new AuditLog(actor, action, targetType, targetId, detail);
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }
}
