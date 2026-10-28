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
 * 레이팅 스냅샷 (D32): 사용자가 누른 시점의 합계·소계 사본. setter는 없다.
 * snapshotDate는 Asia/Seoul 기준 날짜이고, (사용자, 옵션, 날짜)가 유일하다.
 * 2026-10-27(D32 변경): 같은 날 다시 누르면 새 줄을 만들지 않고 오늘 줄의 점수를 덮어쓴다(replaceScores). 지난 날짜의 줄은 바꾸지 않는다.
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

    /**
     * 스냅샷을 만든 시점의 레이팅 목록 평균 난이도(서열표 기준 난이도 T의 평균, 소수 둘째 자리 반올림).
     * 서열표는 나중에 바뀔 수 있어서 그때의 값을 같이 남긴다. 이 기능 이전에 만든 스냅샷과 기준 난이도가 없는 목록은 null이다.
     */
    @Column(name = "average_level", precision = 5, scale = 2)
    private BigDecimal averageLevel;

    private SkillSnapshot(User user, NoteOption noteOption, LocalDate snapshotDate,
                          BigDecimal totalScore, BigDecimal singleScore, BigDecimal otherScore, BigDecimal averageLevel) {
        this.user = user;
        this.noteOption = noteOption;
        this.snapshotDate = snapshotDate;
        this.totalScore = totalScore;
        this.singleScore = singleScore;
        this.otherScore = otherScore;
        this.averageLevel = averageLevel;
    }

    public static SkillSnapshot create(User user, NoteOption noteOption, LocalDate snapshotDate,
                                       BigDecimal totalScore, BigDecimal singleScore, BigDecimal otherScore) {
        return new SkillSnapshot(user, noteOption, snapshotDate, totalScore, singleScore, otherScore, null);
    }

    public static SkillSnapshot create(User user, NoteOption noteOption, LocalDate snapshotDate,
                                       BigDecimal totalScore, BigDecimal singleScore, BigDecimal otherScore, BigDecimal averageLevel) {
        return new SkillSnapshot(user, noteOption, snapshotDate, totalScore, singleScore, otherScore, averageLevel);
    }

    /** 오늘 기록 갱신(D32 변경): 같은 날 다시 기록하면 점수와 그 시점의 평균 난이도를 지금 값으로 바꾼다. 날짜·사용자·옵션은 그대로다. */
    public void replaceScores(BigDecimal totalScore, BigDecimal singleScore, BigDecimal otherScore, BigDecimal averageLevel) {
        this.totalScore = totalScore;
        this.singleScore = singleScore;
        this.otherScore = otherScore;
        this.averageLevel = averageLevel;
    }

    /** 합계·단일 소계·그 외 소계가 모두 같으면 "변경 없음"이다. 스케일(2자리)이 달라도 값이 같으면 같다(compareTo). */
    public boolean hasSameScores(BigDecimal total, BigDecimal single, BigDecimal other) {
        return totalScore.compareTo(total) == 0 && singleScore.compareTo(single) == 0 && otherScore.compareTo(other) == 0;
    }
}
