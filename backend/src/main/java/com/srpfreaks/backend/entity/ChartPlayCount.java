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
 * (사용자, 채보)별 플레이 횟수 (D84). 서열표 분석용 집계이고 화면·API로 내보내지 않는다. setter 없음.
 * 쓰기는 ChartPlayCountRepository.addPlays(원자적 upsert)로만 하므로 이 엔티티를 직접 save하지 않는다. 읽기·스키마 검증(validate)용 매핑이다.
 */
@Getter
@Entity
@Table(name = "chart_play_counts")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChartPlayCount extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "chart_play_count_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_difficulty_id", nullable = false)
    private SongDifficulty songDifficulty;

    @Column(name = "play_count", nullable = false)
    private int playCount;

    /** 센 플레이 중 가장 늦은 플레이 시각(UTC). */
    @Column(name = "last_played_at")
    private Instant lastPlayedAt;
}
