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

import java.time.Instant;

/**
 * 가져오기 전용 토큰(D34). 로그인 토큰과 달리 만료 시각이 없고, 사용자가 폐기하거나 새로 발급할 때까지 쓸 수 있다.
 * 북마클릿 안에 들어가 공식 사이트 페이지에서 쓰이므로 권한을 가져오기 하나로 좁혔다(경로는 인증 필터가 제한한다).
 * 토큰 원문은 저장하지 않고 SHA-256 해시만 저장한다(RefreshToken과 같은 방식).
 */
@Getter
@Entity
@Table(name = "import_tokens")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ImportToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "import_token_id")
    private Long id;

    // 토큰을 검사할 때마다 사용자까지 끌어오지 않도록 LAZY (필요한 곳에서만 접근한다)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // CHAR 컬럼은 columnDefinition을 줘야 Hibernate validate가 VARCHAR와 혼동하지 않는다(RefreshToken과 같다).
    @Column(name = "token_hash", nullable = false, updatable = false, columnDefinition = "CHAR(64)")
    private String tokenHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    private ImportToken(User user, String tokenHash) {
        this.user = user;
        this.tokenHash = tokenHash;
    }

    public static ImportToken issue(User user, String tokenHash) {
        if (user == null || tokenHash == null) {
            throw new IllegalArgumentException("사용자와 토큰 해시는 필수입니다.");
        }
        return new ImportToken(user, tokenHash);
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    /** 이미 폐기됐다면 처음 폐기한 시각을 유지한다. */
    public void revoke(Instant now) {
        if (this.revokedAt == null) {
            this.revokedAt = now;
        }
    }

    public void markUsed(Instant now) {
        this.lastUsedAt = now;
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }
}
