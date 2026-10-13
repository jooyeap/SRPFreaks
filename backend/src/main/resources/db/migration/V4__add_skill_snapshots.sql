-- 레이팅 스냅샷 (D32). 사용자가 `기록하기`를 누른 시점의 합계·소계를 날짜별로 한 줄씩 남긴다(추이 보기용 사본).
-- 원본은 여전히 option_records이고, 레이팅 화면은 계속 계산한 값을 보여 준다 (D3: 스킬은 계산이 기본).
-- snapshot_date는 Asia/Seoul 기준 날짜다. (user_id, note_option, snapshot_date)가 유일해서 하루 1회를 DB가 마지막으로 보장한다
-- (동시에 두 번 눌러도 한 줄만 들어간다). 사용자가 탈퇴하면 같이 지워진다(D20).
-- 점수는 화면에 내보내는 값(소수 둘째 자리 반올림)을 그대로 저장한다. "변경 없음" 비교도 이 값끼리 한다.
CREATE TABLE skill_snapshots (
    skill_snapshot_id BIGINT        NOT NULL AUTO_INCREMENT,
    user_id           BIGINT        NOT NULL,
    note_option       VARCHAR(20)   NOT NULL,
    snapshot_date     DATE          NOT NULL,
    total_score       DECIMAL(10,2) NOT NULL,
    single_score      DECIMAL(10,2) NOT NULL,
    other_score       DECIMAL(10,2) NOT NULL,
    created_at        DATETIME(6)   NOT NULL,
    updated_at        DATETIME(6)   NOT NULL,
    PRIMARY KEY (skill_snapshot_id),
    UNIQUE KEY uk_skill_snapshots_day (user_id, note_option, snapshot_date),
    CONSTRAINT fk_skill_snapshots_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
