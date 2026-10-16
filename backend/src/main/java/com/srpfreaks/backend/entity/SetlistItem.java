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

import java.time.Instant;

/**
 * 세트리스트 한 줄 (D36): 사용자가 오늘 칠 채보로 담아 둔 것. 값은 만들 때만 정해지고 바뀌지 않는다(빼고 다시 담으면 새 줄).
 * 완료 여부는 저장하지 않고, 담은 시각 이후에 그 채보 기록이 저장·수정됐는지로 계산한다(isDoneBy).
 * 같은 (사용자, 채보)는 한 줄만 있다(DB UNIQUE).
 */
@Getter
@Entity
@Table(name = "setlist_items")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SetlistItem extends BaseTimeEntity {

    /** 한 사람이 담을 수 있는 최대 곡 수. */
    public static final int MAX_ITEMS = 30;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "setlist_item_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_difficulty_id", nullable = false)
    private SongDifficulty songDifficulty;

    private SetlistItem(User user, SongDifficulty songDifficulty) {
        this.user = user;
        this.songDifficulty = songDifficulty;
    }

    public static SetlistItem create(User user, SongDifficulty songDifficulty) {
        return new SetlistItem(user, songDifficulty);
    }

    /**
     * 담은 뒤에 그 채보 기록이 저장·수정됐으면 완료다. latestRecordUpdate는 내 SRN+ 기록의 가장 최근 수정 시각(없으면 null).
     * 담은 시각과 같은 순간도 완료로 본다(경계값: 이후 또는 같음).
     */
    public boolean isDoneBy(Instant latestRecordUpdate) {
        return latestRecordUpdate != null && !latestRecordUpdate.isBefore(getCreatedAt());
    }
}
