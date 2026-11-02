package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 서열표 변경 알림 한 줄(D61). 내가 기록한 채보의 기준 난이도가 바뀌어 그 채보의 내 점수가 달라졌을 때 만든다.
 *
 * 점수는 저장하지 않는다. 바뀐 기준 난이도(전·후)와 그때의 내 최고 달성률(myRate)만 두고, 점수는 읽을 때 계산한다
 * (CLAUDE.md "스킬 값은 저장하지 않고 계산"). 곡명은 저장하지 않고 읽을 때 songs에서 붙인다.
 * bundled면 한 번 확인할 때 생긴 songCount채보를 묶은 줄이고, 채보·값은 묶음의 첫 채보다.
 */
@Getter
@Entity
@Table(name = "tier_notifications")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TierNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tier_notification_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_difficulty_id", nullable = false)
    private SongDifficulty songDifficulty;

    /** 바뀌기 전 기준 난이도. null = 미정. */
    @Column(name = "before_tier", precision = 3, scale = 1)
    private BigDecimal beforeTier;

    /** 바뀐 뒤 기준 난이도. null = 미정. */
    @Column(name = "after_tier", precision = 3, scale = 1)
    private BigDecimal afterTier;

    /** 알림을 만든 시점의 내 SRN+ 최고 달성률. 전·후 점수를 같은 달성률로 계산해야 "서열표 때문에 바뀐 점수"가 된다. */
    @Column(name = "my_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal myRate;

    @Column(name = "bundled", nullable = false)
    private boolean bundled;

    @Column(name = "song_count", nullable = false)
    private int songCount;

    /** 서열표가 바뀐 시각(감사 로그 시각). 알림 목록은 이 시각으로 정렬한다. */
    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    private TierNotification(User user, SongDifficulty songDifficulty, BigDecimal beforeTier, BigDecimal afterTier,
                             BigDecimal myRate, boolean bundled, int songCount, Instant changedAt, Instant createdAt) {
        this.user = user;
        this.songDifficulty = songDifficulty;
        this.beforeTier = beforeTier;
        this.afterTier = afterTier;
        this.myRate = myRate;
        this.bundled = bundled;
        this.songCount = songCount;
        this.changedAt = changedAt;
        this.createdAt = createdAt;
    }

    /** 채보 하나의 알림. */
    public static TierNotification single(User user, SongDifficulty chart, BigDecimal beforeTier, BigDecimal afterTier,
                                          BigDecimal myRate, Instant changedAt, Instant now) {
        return new TierNotification(user, chart, beforeTier, afterTier, myRate, false, 1, changedAt, now);
    }

    /** 여러 채보를 한 줄로 묶은 알림. 값은 첫 채보의 것이다. */
    public static TierNotification bundle(User user, SongDifficulty firstChart, BigDecimal beforeTier, BigDecimal afterTier,
                                          BigDecimal myRate, int songCount, Instant changedAt, Instant now) {
        if (songCount < 2) {
            throw new IllegalArgumentException("묶음은 2채보 이상이어야 합니다.");
        }
        return new TierNotification(user, firstChart, beforeTier, afterTier, myRate, true, songCount, changedAt, now);
    }

    public void markRead(Instant now) {
        if (this.readAt == null) {
            this.readAt = now;
        }
    }
}
