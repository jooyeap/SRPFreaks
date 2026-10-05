package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 운영 설정(key-value). 레이팅 계수(rating.*), 이미지 표시 여부(ui.show_song_images) 등.
 * 수식의 모양은 코드에 있고 숫자만 여기서 읽는다. 값은 ROOT만 바꾼다.
 */
@Getter
@Entity
@Table(name = "app_settings")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AppSetting {

    @Id
    @Column(name = "setting_key", length = 50)
    private String key;

    @Column(name = "setting_value", nullable = false, length = 500)
    private String value;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    private AppSetting(String key, String value, User updatedBy) {
        this.key = key;
        this.value = value;
        this.updatedBy = updatedBy;
    }

    public static AppSetting create(String key, String value, User updatedBy) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("설정 키는 비어 있을 수 없다.");
        }
        requireValue(value);
        return new AppSetting(key, value, updatedBy);
    }

    public void change(String value, User updatedBy) {
        requireValue(value);
        this.value = value;
        this.updatedBy = updatedBy;
    }

    @PrePersist
    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    private static void requireValue(String value) {
        if (value == null) {
            throw new IllegalArgumentException("설정 값은 null일 수 없다.");
        }
    }
}
