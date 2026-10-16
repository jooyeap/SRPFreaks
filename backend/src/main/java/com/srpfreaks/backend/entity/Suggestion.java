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

/**
 * 건의사항 (D35). 사용자가 보내고(create), 관리자가 상태·답변을 바꾼다(review).
 * 본문은 글자만 저장한다(HTML 해석 없음). 값은 setter가 아니라 의미 있는 메서드로만 바꾼다.
 * 쓴 사람(user)은 연관관계 LAZY. 관리자 목록에서 닉네임이 필요할 때만 fetch join 한다(N+1 방지).
 */
@Getter
@Entity
@Table(name = "suggestions")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Suggestion extends BaseTimeEntity {

    public static final int TITLE_MAX_LENGTH = 100;
    public static final int CONTENT_MAX_LENGTH = 2000;
    public static final int ADMIN_NOTE_MAX_LENGTH = 500;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "suggestion_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 20)
    private SuggestionCategory category;

    @Column(name = "title", nullable = false, length = TITLE_MAX_LENGTH)
    private String title;

    @Column(name = "content", nullable = false, length = CONTENT_MAX_LENGTH)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SuggestionStatus status;

    @Column(name = "admin_note", length = ADMIN_NOTE_MAX_LENGTH)
    private String adminNote;

    private Suggestion(User user, SuggestionCategory category, String title, String content) {
        if (category == null) {
            throw new IllegalArgumentException("종류를 선택해 주세요.");
        }
        this.user = user;
        this.category = category;
        this.status = SuggestionStatus.RECEIVED;
        String trimmedTitle = title == null ? "" : title.strip();
        String trimmedContent = content == null ? "" : content.strip();
        if (trimmedTitle.isEmpty() || trimmedTitle.length() > TITLE_MAX_LENGTH) {
            throw new IllegalArgumentException("제목은 1자 이상 " + TITLE_MAX_LENGTH + "자 이하여야 합니다.");
        }
        if (trimmedContent.isEmpty() || trimmedContent.length() > CONTENT_MAX_LENGTH) {
            throw new IllegalArgumentException("내용은 1자 이상 " + CONTENT_MAX_LENGTH + "자 이하여야 합니다.");
        }
        this.title = trimmedTitle;
        this.content = trimmedContent;
    }

    public static Suggestion create(User user, SuggestionCategory category, String title, String content) {
        return new Suggestion(user, category, title, content);
    }

    /** 관리자가 처리 상태와 답변을 바꾼다. 답변은 비워도 된다(빈 문자열은 NULL로 저장). */
    public void review(SuggestionStatus status, String adminNote) {
        if (status == null) {
            throw new IllegalArgumentException("상태를 선택해 주세요.");
        }
        String trimmed = adminNote == null ? "" : adminNote.strip();
        if (trimmed.length() > ADMIN_NOTE_MAX_LENGTH) {
            throw new IllegalArgumentException("답변은 " + ADMIN_NOTE_MAX_LENGTH + "자 이하여야 합니다.");
        }
        this.status = status;
        this.adminNote = trimmed.isEmpty() ? null : trimmed;
    }
}
