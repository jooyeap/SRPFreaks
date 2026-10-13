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

/**
 * 곡 마스터. ROOT·ADMIN이 직접 등록한다(자동 등록 금지). 노트 수/BPM/버전 등 메타데이터는 비어 있어도 된다.
 * 삭제는 소프트 삭제(deleted)라서, 조회할 때 Repository에서 deleted=false로 명시적으로 거른다.
 */
@Getter
@Entity
@Table(name = "songs")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Song extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "song_id")
    private Long id;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    /** 아티스트는 게임 표기 하나만 둔다(작곡가 컬럼 없음). */
    @Column(name = "artist", length = 255)
    private String artist;

    @Column(name = "added_version", length = 30)
    private String addedVersion;

    @Column(name = "title_folder", length = 5)
    private String titleFolder;

    @Column(name = "bpm_min")
    private Integer bpmMin;

    @Column(name = "bpm_max")
    private Integer bpmMax;

    /** 기본 NULL. 설정 ui.show_song_images가 켜졌을 때만 화면에서 쓴다(D7, D21). */
    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /** 출처 표기. 예: sheet-v1.1 */
    @Column(name = "source", length = 100)
    private String source;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    private Song(String title, String artist, String source, User createdBy) {
        this.title = title;
        this.artist = artist;
        this.source = source;
        this.createdBy = createdBy;
    }

    public static Song create(String title, String artist, String source, User createdBy) {
        requireTitle(title);
        return new Song(title, artist, source, createdBy);
    }

    public void changeTitle(String title) {
        requireTitle(title);
        this.title = title;
    }

    public void changeArtist(String artist) {
        this.artist = artist;
    }

    public void changeMeta(String addedVersion, String titleFolder, Integer bpmMin, Integer bpmMax) {
        if (bpmMin != null && bpmMax != null && bpmMin > bpmMax) {
            throw new IllegalArgumentException("최소 BPM은 최대 BPM보다 클 수 없습니다.");
        }
        this.addedVersion = addedVersion;
        this.titleFolder = titleFolder;
        this.bpmMin = bpmMin;
        this.bpmMax = bpmMax;
    }

    public void changeImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public void delete() {
        this.deleted = true;
    }

    public void restore() {
        this.deleted = false;
    }

    private static void requireTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("곡명은 비워 둘 수 없습니다.");
        }
    }
}
