package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 난이도표. SRN+ 서열표가 첫 사례(D8)이고 다른 표가 생겨도 되도록 표 자체를 행으로 둔다.
 * note_option은 이 표가 기준으로 삼는 옵션이다.
 */
@Getter
@Entity
@Table(name = "difficulty_tables")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DifficultyTable extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "difficulty_table_id")
    private Long id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** null이면 기타·베이스 모두. */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "instrument_part", length = 10)
    private InstrumentPart instrumentPart;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "note_option", nullable = false, length = 20)
    private NoteOption noteOption;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    private TableStatus status;

    /** 표를 고칠 때마다 올린다(변경 추적용). */
    @Column(name = "revision", nullable = false)
    private int revision;

    private DifficultyTable(String name, InstrumentPart instrumentPart, NoteOption noteOption) {
        this.name = name;
        this.instrumentPart = instrumentPart;
        this.noteOption = noteOption;
        this.status = TableStatus.ACTIVE;
        this.revision = 1;
    }

    public static DifficultyTable create(String name, InstrumentPart instrumentPart, NoteOption noteOption) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("표 이름은 비워 둘 수 없습니다.");
        }
        if (noteOption == null) {
            throw new IllegalArgumentException("기준 옵션은 필수입니다.");
        }
        return new DifficultyTable(name, instrumentPart, noteOption);
    }

    public void bumpRevision() {
        this.revision++;
    }

    public void activate() {
        this.status = TableStatus.ACTIVE;
    }

    public void deactivate() {
        this.status = TableStatus.INACTIVE;
    }
}
