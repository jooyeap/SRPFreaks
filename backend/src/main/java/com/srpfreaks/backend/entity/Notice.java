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
 * 공지사항 (D30). 수정사항·안내를 ROOT·ADMIN이 쓰고, 로그인한 사용자가 읽는다.
 * 본문은 글자만 저장한다(HTML 해석 없음). 쓴 사람(author)은 응답에 내보내지 않고, 탈퇴하면 NULL이 된다.
 * 값은 setter가 아니라 의미 있는 메서드(create, edit)로만 바꾼다.
 */
@Getter
@Entity
@Table(name = "notices")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notice extends BaseTimeEntity {

    public static final int TITLE_MAX_LENGTH = 100;
    public static final int CONTENT_MAX_LENGTH = 5000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notice_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private User author;

    @Column(name = "title", nullable = false, length = TITLE_MAX_LENGTH)
    private String title;

    @Column(name = "content", nullable = false, length = CONTENT_MAX_LENGTH)
    private String content;

    private Notice(User author, String title, String content) {
        this.author = author;
        apply(title, content);
    }

    public static Notice create(User author, String title, String content) {
        return new Notice(author, title, content);
    }

    /** 제목과 본문을 고친다. 쓴 사람은 처음 쓴 사람 그대로 둔다. */
    public void edit(String title, String content) {
        apply(title, content);
    }

    private void apply(String title, String content) {
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
}
