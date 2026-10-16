-- 건의사항(D35). 로그인한 사용자가 곡 추가·개선사항·버그 제보 등을 보내고, ROOT·ADMIN이 상태와 답변을 남긴다.
-- 본문은 글자(plain text)만 저장한다(공지사항과 같은 규칙). 이미지 첨부는 받지 않는다.
-- category/status는 확장 대비로 VARCHAR에 enum 이름을 넣는다.
-- 탈퇴하면 건의도 함께 삭제한다(D20: 사용자와 그 사용자의 데이터를 완전히 삭제). 그래서 FK는 ON DELETE CASCADE다.
CREATE TABLE suggestions (
    suggestion_id BIGINT        NOT NULL AUTO_INCREMENT,
    user_id       BIGINT        NOT NULL,
    category      VARCHAR(20)   NOT NULL,
    title         VARCHAR(100)  NOT NULL,
    content       VARCHAR(2000) NOT NULL,
    status        VARCHAR(20)   NOT NULL,
    admin_note    VARCHAR(500)  NULL,
    created_at    DATETIME(6)   NOT NULL,
    updated_at    DATETIME(6)   NOT NULL,
    PRIMARY KEY (suggestion_id),
    KEY ix_suggestions_user_created (user_id, created_at),
    KEY ix_suggestions_status_created (status, created_at),
    CONSTRAINT fk_suggestions_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
