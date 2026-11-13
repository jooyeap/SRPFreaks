-- 내 리스트(D76). 이름을 붙여 오래 두는 개인 곡 모음(연습 곡 등). 나만 보고 공유하지 않는다.
-- 세트리스트(setlist_items, 오늘 칠 곡 임시 목록)와 별개이고 세트리스트 로직은 바뀌지 않는다.
-- 삭제는 소프트 삭제 없이 행을 지운다(세트리스트와 같은 개인 임시성 데이터, DESIGN.md D76). 리스트를 지우면 항목도 함께 지워진다.
-- 탈퇴하면 users 행 삭제에 따라 두 테이블 모두 완전 삭제된다(D20, ON DELETE CASCADE). 채보가 지워져도(하드 삭제) 항목은 따라 지워진다.
-- 이름은 서버가 NFKC·앞뒤 공백 제거한 값으로 저장한다. UNIQUE(user_id, name)는 utf8mb4_unicode_ci라 대소문자를 구분하지 않는다.
CREATE TABLE user_lists (
    user_list_id BIGINT      NOT NULL AUTO_INCREMENT,
    user_id      BIGINT      NOT NULL,
    name         VARCHAR(20) NOT NULL,
    sort_order   INT         NOT NULL,
    created_at   DATETIME(6) NOT NULL,
    updated_at   DATETIME(6) NOT NULL,
    PRIMARY KEY (user_list_id),
    UNIQUE KEY uq_user_list_name (user_id, name),
    KEY ix_user_list_order (user_id, sort_order),
    CONSTRAINT fk_user_list_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT ck_user_list_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_list_items (
    user_list_item_id  BIGINT      NOT NULL AUTO_INCREMENT,
    user_list_id       BIGINT      NOT NULL,
    song_difficulty_id BIGINT      NOT NULL,
    sort_order         INT         NOT NULL,
    created_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (user_list_item_id),
    UNIQUE KEY uq_user_list_item_chart (user_list_id, song_difficulty_id),
    KEY ix_user_list_item_order (user_list_id, sort_order),
    KEY ix_user_list_item_song_difficulty (song_difficulty_id),
    CONSTRAINT fk_user_list_item_list FOREIGN KEY (user_list_id) REFERENCES user_lists (user_list_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_list_item_song_difficulty FOREIGN KEY (song_difficulty_id) REFERENCES song_difficulties (song_difficulty_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 상한은 코드에 숫자를 두지 않고 여기서 읽는다(ROOT가 바꾼다).
-- list.max_lists : 한 사람이 만들 수 있는 리스트 수
-- list.max_items : 리스트 하나에 담을 수 있는 곡 수
INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at) VALUES
    ('list.max_lists', '10', NULL, UTC_TIMESTAMP(6)),
    ('list.max_items', '50', NULL, UTC_TIMESTAMP(6));
