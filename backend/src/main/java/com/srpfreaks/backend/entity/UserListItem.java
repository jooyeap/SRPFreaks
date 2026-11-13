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
 * 내 리스트의 한 줄 (D76): 리스트에 담은 채보 하나. 같은 (리스트, 채보)는 한 줄만 있다(DB UNIQUE).
 * 담은 시각(created_at)만 두고 수정 시각은 두지 않는다 — 바뀌는 값은 순서(sortOrder)뿐이다.
 * 달성률·단계는 저장하지 않고 내 기록에서 계산한다.
 */
@Getter
@Entity
@Table(name = "user_list_items")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserListItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_list_item_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_list_id", nullable = false)
    private UserList userList;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_difficulty_id", nullable = false)
    private SongDifficulty songDifficulty;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    private UserListItem(UserList userList, SongDifficulty songDifficulty, int sortOrder) {
        this.userList = userList;
        this.songDifficulty = songDifficulty;
        this.sortOrder = sortOrder;
    }

    public static UserListItem create(UserList userList, SongDifficulty songDifficulty, int sortOrder) {
        return new UserListItem(userList, songDifficulty, sortOrder);
    }

    public void moveTo(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }
}
