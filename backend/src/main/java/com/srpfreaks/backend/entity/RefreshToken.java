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
 * Refresh Token. 토큰 원문은 저장하지 않고 SHA-256 해시만 저장한다.
 * family_id는 로그인 1회당 하나로, Rotation(재발급 때마다 새 토큰) 중 이미 쓴 토큰이 다시 오면
 * 같은 family 전체를 폐기하는 재사용 탐지에 쓴다.
 */
@Getter
@Entity
@Table(name = "refresh_tokens")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "refresh_token_id")
    private Long id;

    // 연관관계는 기본 LAZY. 토큰을 검사할 때마다 사용자까지 끌어오지 않기 위해서다.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // CHAR 컬럼은 columnDefinition을 줘야 Hibernate validate가 VARCHAR와 혼동하지 않는다.
    @Column(name = "family_id", nullable = false, updatable = false, columnDefinition = "CHAR(36)")
    private String familyId;

    @Column(name = "token_hash", nullable = false, updatable = false, columnDefinition = "CHAR(64)")
    private String tokenHash;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    private RefreshToken(User user, String familyId, String tokenHash, Instant expiresAt) {
        this.user = user;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public static RefreshToken issue(User user, String familyId, String tokenHash, Instant expiresAt) {
        if (user == null || familyId == null || tokenHash == null || expiresAt == null) {
            throw new IllegalArgumentException("user, familyId, tokenHash, expiresAt은 필수다.");
        }
        return new RefreshToken(user, familyId, tokenHash, expiresAt);
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

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public boolean isExpired(Instant now) {
        return !expiresAt.isAfter(now);
    }

    /** 폐기되지 않았고 만료 전일 때만 쓸 수 있다. */
    public boolean isUsable(Instant now) {
        return !isRevoked() && !isExpired(now);
    }
}
