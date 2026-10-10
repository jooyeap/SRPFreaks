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
import java.time.LocalDate;

/**
 * 레이팅 스냅샷 (D32): 사용자가 누른 시점의 합계·소계 사본. 만든 뒤에는 바꾸지 않는다(setter 없음, 수정 메서드 없음).
 * snapshotDate는 Asia/Seoul 기준 날짜이고, (사용자, 옵션, 날짜)가 유일하다.
 */
@Getter
@Entity
@Table(name = "skill_snapshots")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SkillSnapshot extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "skill_snapshot_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "note_option", nullable = false, length = 20)
    private NoteOption noteOption;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "total_score", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalScore;

    @Column(name = "single_score", nullable = false, precision = 10, scale = 2)
    private BigDecimal singleScore;

    @Column(name = "other_score", nullable = false, precision = 10, scale = 2)
    private BigDecimal otherScore;

    private SkillSnapshot(User user, NoteOption noteOption, LocalDate snapshotDate,
                          BigDecimal totalScore, BigDecimal singleScore, BigDecimal otherScore) {
        this.user = user;
        this.noteOption = noteOption;
        this.snapshotDate = snapshotDate;
        this.totalScore = totalScore;
        this.singleScore = singleScore;
        this.otherScore = otherScore;
    }

    public static SkillSnapshot create(User user, NoteOption noteOption, LocalDate snapshotDate,
                                       BigDecimal totalScore, BigDecimal singleScore, BigDecimal otherScore) {
        return new SkillSnapshot(user, noteOption, snapshotDate, totalScore, singleScore, otherScore);
    }

    /** 합계·단일 소계·그 외 소계가 모두 같으면 "변경 없음"이다. 스케일(2자리)이 달라도 값이 같으면 같다(compareTo). */
    public boolean hasSameScores(BigDecimal total, BigDecimal single, BigDecimal other) {
        return totalScore.compareTo(total) == 0 && singleScore.compareTo(single) == 0 && otherScore.compareTo(other) == 0;
    }
}
