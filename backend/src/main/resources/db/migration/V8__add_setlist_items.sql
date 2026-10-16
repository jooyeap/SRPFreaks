-- 세트리스트(D36). 게임장에 가기 전에 오늘 칠 채보를 미리 담아 두는 사용자별 임시 목록이다.
-- 완료 여부는 저장하지 않는다: 담은 시각(created_at) 이후에 그 채보 기록을 저장·수정했는지로 계산한다.
-- 임시 목록이라 소프트 삭제 없이 행을 지운다. 탈퇴하면 함께 삭제한다(D20). 채보가 지워져도(하드 삭제) 따라 지워진다.
CREATE TABLE setlist_items (
    setlist_item_id    BIGINT      NOT NULL AUTO_INCREMENT,
    user_id            BIGINT      NOT NULL,
    song_difficulty_id BIGINT      NOT NULL,
    created_at         DATETIME(6) NOT NULL,
    updated_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (setlist_item_id),
    UNIQUE KEY uq_setlist_user_chart (user_id, song_difficulty_id),
    KEY ix_setlist_song_difficulty (song_difficulty_id),
    CONSTRAINT fk_setlist_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_setlist_song_difficulty FOREIGN KEY (song_difficulty_id) REFERENCES song_difficulties (song_difficulty_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
