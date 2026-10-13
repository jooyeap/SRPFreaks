-- 가져오기 전용 토큰 (D34). 공식 사이트 최근 플레이를 읽는 북마클릿이 SRPFreaks API로 기록을 보낼 때만 쓰는 토큰이다.
-- 로그인(Access/Refresh) 토큰과 별개이고 가져오기 경로 하나에서만 통한다. 토큰 원문은 저장하지 않고 SHA-256 해시만 저장한다.
-- 사용자당 쓸 수 있는 토큰은 하나(새로 발급하면 이전 것은 폐기)이고, 폐기한 줄은 이력으로 남긴다.
-- 사용자가 탈퇴하면 같이 지워진다(D20).
CREATE TABLE import_tokens (
    import_token_id BIGINT      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT      NOT NULL,
    token_hash      CHAR(64)    NOT NULL,
    created_at      DATETIME(6) NOT NULL,
    last_used_at    DATETIME(6) NULL,
    revoked_at      DATETIME(6) NULL,
    PRIMARY KEY (import_token_id),
    UNIQUE KEY uk_import_tokens_hash (token_hash),
    KEY ix_import_tokens_user (user_id, revoked_at),
    CONSTRAINT fk_import_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
