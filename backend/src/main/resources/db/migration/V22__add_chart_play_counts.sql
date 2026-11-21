-- 플레이 횟수 집계 (D84). 서열표 분석에서 "이 채보를 몇 번 쳤나"를 보기 위한 집계용 테이블이다.
-- 추가만 한다(새 테이블 2개). 기존 테이블·열·데이터는 건드리지 않으므로, 되돌릴 때는 코드를 되돌리고 이 테이블을 쓰지 않으면 된다.
--
-- chart_play_counts: (사용자, 채보)당 한 줄. 횟수와 마지막으로 센 플레이 시각뿐이고, 플레이 한 번씩의 목록은 저장하지 않는다.
--  - play_count     : 가져오기·직접 입력·사진 입력으로 "본" 플레이 수. 저장하지 않은(낮은 점수) 플레이도 센다.
--  - last_played_at : 센 플레이 중 가장 늦은 플레이 시각(UTC).
-- play_count_cursors: 가져오기 중복 집계를 막는 사용자별 "마지막으로 센 플레이 시각". 같은 최근 플레이를 다시 가져와도 두 번 세지 않는다.
--  users에 열을 붙이지 않고 별도 테이블로 둔 이유: 인증·권한이 걸린 users를 건드리지 않고(ALTER 없음), 이 기능을 쓰지 않기로 하면
--  테이블만 비워 두면 되며, 탈퇴 시 CASCADE로 함께 지워진다.
-- 탈퇴하면 users 행 삭제에 따라 두 테이블 모두 완전 삭제된다(D20, ON DELETE CASCADE). 채보가 지워져도(하드 삭제) 횟수는 따라 지워진다.
CREATE TABLE chart_play_counts (
    chart_play_count_id BIGINT      NOT NULL AUTO_INCREMENT,
    user_id             BIGINT      NOT NULL,
    song_difficulty_id  BIGINT      NOT NULL,
    play_count          INT         NOT NULL DEFAULT 0,
    last_played_at      DATETIME(6) NULL,
    created_at          DATETIME(6) NOT NULL,
    updated_at          DATETIME(6) NOT NULL,
    PRIMARY KEY (chart_play_count_id),
    UNIQUE KEY uq_chart_play_counts_user_chart (user_id, song_difficulty_id),
    KEY ix_chart_play_counts_song_difficulty (song_difficulty_id),
    CONSTRAINT ck_chart_play_counts_count CHECK (play_count >= 0),
    CONSTRAINT fk_chart_play_counts_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_chart_play_counts_song_difficulty FOREIGN KEY (song_difficulty_id) REFERENCES song_difficulties (song_difficulty_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE play_count_cursors (
    user_id         BIGINT      NOT NULL,
    last_counted_at DATETIME(6) NULL,
    created_at      DATETIME(6) NOT NULL,
    updated_at      DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_play_count_cursors_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
