-- 레이팅 스냅샷의 곡별 상세 (D32 확장). 스냅샷을 누른 시점의 레이팅 목록(단일 15 + 그 외 25)을 그대로 사본으로 남겨서
-- 날짜별 비교(오른 곡, 새로 들어온 곡, 빠진 곡)를 기록 테이블의 수정·삭제와 상관없이 정확하게 한다.
-- 이 변경 전에 만든 스냅샷에는 상세가 없다(비교 불가). 만든 뒤에는 바꾸지 않는다.
CREATE TABLE skill_snapshot_entries (
    skill_snapshot_entry_id BIGINT        NOT NULL AUTO_INCREMENT,
    skill_snapshot_id       BIGINT        NOT NULL,
    song_difficulty_id      BIGINT        NOT NULL,
    list_group              VARCHAR(10)   NOT NULL,              -- SINGLE / OTHER
    list_rank               INT           NOT NULL,              -- 그룹 안의 순위(1부터)
    achievement_rate        DECIMAL(5,2)  NOT NULL,
    is_full_combo           BOOLEAN       NOT NULL DEFAULT FALSE,
    score                   DECIMAL(10,2) NOT NULL,              -- 화면 점수(V x 20, 소수 둘째 자리 반올림)
    created_at              DATETIME(6)   NOT NULL,
    updated_at              DATETIME(6)   NOT NULL,
    PRIMARY KEY (skill_snapshot_entry_id),
    UNIQUE KEY uk_skill_snapshot_entries_chart (skill_snapshot_id, song_difficulty_id),
    KEY ix_skill_snapshot_entries_difficulty (song_difficulty_id),
    CONSTRAINT fk_skill_snapshot_entries_snapshot FOREIGN KEY (skill_snapshot_id)
        REFERENCES skill_snapshots (skill_snapshot_id) ON DELETE CASCADE,
    CONSTRAINT fk_skill_snapshot_entries_difficulty FOREIGN KEY (song_difficulty_id)
        REFERENCES song_difficulties (song_difficulty_id),
    CONSTRAINT ck_skill_snapshot_entries_rate CHECK (achievement_rate BETWEEN 0.00 AND 100.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
