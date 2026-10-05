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

import java.text.Normalizer;
import java.util.Locale;

/**
 * 곡명 표기(로마자/가타카나/한국어/별칭). 검색과 CSV 곡명 매칭에 쓴다.
 * 비교는 항상 normalized_title로 한다: NFKC 정규화 → 공백/줄바꿈 제거 → 소문자.
 */
@Getter
@Entity
@Table(name = "song_titles")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SongTitle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "song_title_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "kind", nullable = false, length = 20)
    private TitleKind kind;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "normalized_title", nullable = false, length = 255)
    private String normalizedTitle;

    private SongTitle(Song song, TitleKind kind, String title) {
        this.song = song;
        this.kind = kind;
        this.title = title;
        this.normalizedTitle = normalize(title);
    }

    public static SongTitle create(Song song, TitleKind kind, String title) {
        if (song == null || kind == null) {
            throw new IllegalArgumentException("곡과 표기 종류는 필수입니다.");
        }
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("곡명은 비워 둘 수 없습니다.");
        }
        return new SongTitle(song, kind, title);
    }

    /**
     * 곡명 비교용 정규화.
     * NFKC: 전각/반각, 호환 문자(예: ｱ → ア, Ａ → A)를 같은 형태로 맞춘다.
     * 모든 공백(줄바꿈 포함)을 제거하고 소문자로 바꾼다. 소문자는 Locale.ROOT로 해서 기기 언어에 따라 달라지지 않게 한다.
     */
    public static String normalize(String title) {
        if (title == null) {
            return "";
        }
        String nfkc = Normalizer.normalize(title, Normalizer.Form.NFKC);
        return nfkc.replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }
}
