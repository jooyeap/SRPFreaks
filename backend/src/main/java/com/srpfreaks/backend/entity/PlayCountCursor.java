package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 가져오기 중복 집계 방지용 사용자별 "마지막으로 센 플레이 시각" (D84).
 * 이 시각보다 **엄격히 늦은** 플레이만 센다. 줄은 PlayCountCursorRepository.ensureExists가 만들고, 값은 advanceTo로만 앞으로 옮긴다.
 */
@Getter
@Entity
@Table(name = "play_count_cursors")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlayCountCursor extends BaseTimeEntity {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "last_counted_at")
    private Instant lastCountedAt;

    /** 앞으로만 옮긴다: 더 이른 시각이 오면 그대로 둔다(재전송·시계가 어긋난 입력이 커서를 되돌려 중복 집계를 만들지 않게). */
    public void advanceTo(Instant playedAt) {
        if (playedAt != null && (lastCountedAt == null || playedAt.isAfter(lastCountedAt))) {
            this.lastCountedAt = playedAt;
        }
    }
}
