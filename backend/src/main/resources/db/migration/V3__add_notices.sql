-- 공지사항(수정사항 기록, D30). ROOT·ADMIN이 쓰고 로그인한 사용자가 읽는다.
-- 본문은 글자(plain text)만 저장한다. 화면은 줄바꿈만 살려 보여 주므로 HTML을 넣어도 실행되지 않는다.
-- VARCHAR(5000)인 이유: TEXT로 두면 Hibernate의 스키마 검증(validate)이 String 필드와 타입이 다르다고 본다.
-- 쓴 사람이 탈퇴하면 author_id만 NULL로 바뀌고 공지는 남는다 (audit_logs.actor_id와 같은 규칙).
CREATE TABLE notices (
    notice_id  BIGINT        NOT NULL AUTO_INCREMENT,
    author_id  BIGINT        NULL,
    title      VARCHAR(100)  NOT NULL,
    content    VARCHAR(5000) NOT NULL,
    created_at DATETIME(6)   NOT NULL,
    updated_at DATETIME(6)   NOT NULL,
    PRIMARY KEY (notice_id),
    KEY ix_notices_created (created_at),
    CONSTRAINT fk_notices_author FOREIGN KEY (author_id) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
