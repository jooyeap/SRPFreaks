package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import java.time.LocalDate;

/**
 * 라이벌 역전 알림 한 줄(D56). recipient = 역전당한 사람(알림을 받는 사람), actor = 역전한 사람.
 *
 * 흐름: 저장 직후 PENDING(visibleAt = 저장 + 10분) → 받는 사람이 알림을 읽을 때 visibleAt이 지났으면 다시 확인해서
 * show()(따로 보임) / mergeIntoBundle 대상(그날 한 상대에게서 3건이 넘으면 묶음) / 지움 중 하나가 된다.
 * 닉네임·곡명은 저장하지 않는다(읽을 때 users·songs에서 붙인다).
 */
@Getter
@Entity
@Table(name = "rival_notifications")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RivalNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "rival_notification_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_user_id", nullable = false)
    private User recipient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_user_id", nullable = false)
    private User actor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_difficulty_id", nullable = false)
    private SongDifficulty songDifficulty;

    @Column(name = "actor_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal actorRate;

    @Column(name = "recipient_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal recipientRate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private RivalNotificationStatus status;

    /** 그날 한 상대에게서 온 알림이 하루 개수를 넘어 한 줄로 묶인 줄인지. 묶음 줄의 채보는 묶음의 첫 곡이다. */
    @Column(name = "bundled", nullable = false)
    private boolean bundled;

    /** 묶음 줄의 곡 수. 따로 보이는 줄은 1. */
    @Column(name = "song_count", nullable = false)
    private int songCount;

    /** 보인 날(Asia/Seoul). 하루 개수를 셀 때 쓴다. PENDING이면 null. */
    @Column(name = "alert_date")
    private LocalDate alertDate;

    @Column(name = "visible_at", nullable = false)
    private Instant visibleAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    private RivalNotification(User recipient, User actor, SongDifficulty songDifficulty, BigDecimal actorRate,
                              BigDecimal recipientRate, Instant visibleAt, Instant createdAt) {
        this.recipient = recipient;
        this.actor = actor;
        this.songDifficulty = songDifficulty;
        this.actorRate = actorRate;
        this.recipientRate = recipientRate;
        this.status = RivalNotificationStatus.PENDING;
        this.bundled = false;
        this.songCount = 1;
        this.visibleAt = visibleAt;
        this.createdAt = createdAt;
    }

    public static RivalNotification pending(User recipient, User actor, SongDifficulty songDifficulty, BigDecimal actorRate,
                                            BigDecimal recipientRate, Instant visibleAt, Instant now) {
        return new RivalNotification(recipient, actor, songDifficulty, actorRate, recipientRate, visibleAt, now);
    }

    /** 10분 안에 같은 채보로 다시 저장했을 때: 값과 보일 시각만 새로 고친다(한 건으로 합친다). */
    public void refreshPending(BigDecimal actorRate, BigDecimal recipientRate, Instant visibleAt) {
        this.actorRate = actorRate;
        this.recipientRate = recipientRate;
        this.visibleAt = visibleAt;
    }

    /** 다시 확인을 통과해 따로 보인다. 값은 확인한 시점의 최고 기록으로 고친다. */
    public void show(BigDecimal actorRate, BigDecimal recipientRate, LocalDate alertDate) {
        this.actorRate = actorRate;
        this.recipientRate = recipientRate;
        this.alertDate = alertDate;
        this.status = RivalNotificationStatus.SHOWN;
    }

    /** 그날의 묶음 줄을 처음 만들 때: 이 줄을 묶음(곡 1개)으로 보인다. */
    public void showAsBundle(BigDecimal actorRate, BigDecimal recipientRate, LocalDate alertDate) {
        show(actorRate, recipientRate, alertDate);
        this.bundled = true;
    }

    /** 이미 있는 묶음 줄에 곡 하나를 더한다. 새 곡이 생겼으니 다시 안 읽음으로 돌린다. */
    public void addToBundle(Instant visibleAt) {
        this.songCount++;
        this.visibleAt = visibleAt;
        this.readAt = null;
    }

    public void markRead(Instant now) {
        if (this.readAt == null) {
            this.readAt = now;
        }
    }
}
