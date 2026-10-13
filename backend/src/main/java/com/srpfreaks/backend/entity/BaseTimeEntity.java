package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;

import java.time.Instant;

/**
 * created_at / updated_at을 가진 엔티티의 공통 부모.
 * 시간은 UTC 순간(Instant)으로 저장하고, 화면에서 Asia/Seoul로 바꾼다.
 * JPA 콜백(@PrePersist/@PreUpdate)으로 채우므로 별도 설정(@EnableJpaAuditing)이 필요 없다.
 */
@Getter
@MappedSuperclass
public abstract class BaseTimeEntity {

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
