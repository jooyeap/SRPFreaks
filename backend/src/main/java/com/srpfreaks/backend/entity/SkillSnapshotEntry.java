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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;

/**
 * 스냅샷에 들어 있던 레이팅 목록의 한 채보 (D32 확장). 스냅샷과 같이 만들고 바꾸지 않는다(setter 없음).
 * 곡 제목 같은 표시 값은 저장하지 않고 채보(song_difficulty)에서 읽는다. 저장하는 것은 "그때의 값"인 달성률·FC·점수·순위뿐이다.
 */
@Getter
@Entity
@Table(name = "skill_snapshot_entries")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SkillSnapshotEntry extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "skill_snapshot_entry_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "skill_snapshot_id", nullable = false)
    private SkillSnapshot snapshot;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_difficulty_id", nullable = false)
    private SongDifficulty songDifficulty;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "list_group", nullable = false, length = 10)
    private SnapshotGroup listGroup;

    @Column(name = "list_rank", nullable = false)
    private int listRank;

    @Column(name = "achievement_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal achievementRate;

    @Column(name = "is_full_combo", nullable = false)
    private boolean fullCombo;

    @Column(name = "score", nullable = false, precision = 10, scale = 2)
    private BigDecimal score;

    private SkillSnapshotEntry(SkillSnapshot snapshot, SongDifficulty songDifficulty, SnapshotGroup listGroup, int listRank,
                               BigDecimal achievementRate, boolean fullCombo, BigDecimal score) {
        this.snapshot = snapshot;
        this.songDifficulty = songDifficulty;
        this.listGroup = listGroup;
        this.listRank = listRank;
        this.achievementRate = achievementRate;
        this.fullCombo = fullCombo;
        this.score = score;
    }

    public static SkillSnapshotEntry create(SkillSnapshot snapshot, SongDifficulty songDifficulty, SnapshotGroup listGroup,
                                            int listRank, BigDecimal achievementRate, boolean fullCombo, BigDecimal score) {
        return new SkillSnapshotEntry(snapshot, songDifficulty, listGroup, listRank, achievementRate, fullCombo, score);
    }
}
