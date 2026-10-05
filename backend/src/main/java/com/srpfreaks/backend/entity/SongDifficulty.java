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
 * 채보 = (곡, 파트, 난이도 종류). 같은 곡의 MAS와 EXT는 서로 다른 채보다.
 * 레벨은 표시용이고 레이팅 계산에는 쓰지 않는다(계산은 서열표의 기준 난이도).
 */
@Getter
@Entity
@Table(name = "song_difficulties")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SongDifficulty extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "song_difficulty_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "instrument_part", nullable = false, length = 10)
    private InstrumentPart instrumentPart;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "difficulty_type", nullable = false, length = 20)
    private DifficultyType difficultyType;

    /** 예: 9.85. DECIMAL(3,2)라서 0.00 ~ 9.99. */
    @Column(name = "level", nullable = false, precision = 3, scale = 2)
    private BigDecimal level;

    @Column(name = "note_count")
    private Integer noteCount;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    private SongDifficulty(Song song, InstrumentPart part, DifficultyType type, BigDecimal level) {
        this.song = song;
        this.instrumentPart = part;
        this.difficultyType = type;
        this.level = level;
    }

    public static SongDifficulty create(Song song, InstrumentPart part, DifficultyType type, BigDecimal level) {
        if (song == null || part == null || type == null) {
            throw new IllegalArgumentException("song, part, type은 필수다.");
        }
        requireLevel(level);
        return new SongDifficulty(song, part, type, level);
    }

    public void changeLevel(BigDecimal level) {
        requireLevel(level);
        this.level = level;
    }

    public void changeNoteCount(Integer noteCount) {
        if (noteCount != null && noteCount < 0) {
            throw new IllegalArgumentException("노트 수는 음수일 수 없다.");
        }
        this.noteCount = noteCount;
    }

    public void delete() {
        this.deleted = true;
    }

    public void restore() {
        this.deleted = false;
    }

    private static void requireLevel(BigDecimal level) {
        if (level == null || level.signum() < 0 || level.compareTo(new BigDecimal("9.99")) > 0 || level.scale() > 2) {
            throw new IllegalArgumentException("레벨은 0.00 ~ 9.99, 소수 둘째 자리까지여야 한다.");
        }
    }
}
