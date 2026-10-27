-- 세트리스트 담기/빼기 이력 (D52). 추천을 위한 데이터 수집용이다: "어느 난이도대 유저가 어떤 곡에 도전하려다 포기했나"를 집계한다.
-- 세트리스트 자체(D36 임시 목록)는 그대로이고, 이 테이블은 줄을 비우거나 빼도 지우지 않는다. 탈퇴하면 함께 삭제한다(D20).
--  - event_type    : ADD(담기) / REMOVE(직접 빼기). `완료한 곡 비우기`는 거절이 아니라 정리라서 기록하지 않는다.
--  - event_date    : Asia/Seoul 날짜. (사용자, 채보, 종류, 날짜)당 한 줄만 남겨 담았다 뺐다 반복해도 숫자가 부풀지 않게 한다.
--  - average_level : 그때 사용자의 평균 난이도(PlayLevelEstimator가 READY일 때만, 아니면 NULL).
CREATE TABLE setlist_events (
    setlist_event_id   BIGINT       NOT NULL AUTO_INCREMENT,
    user_id            BIGINT       NOT NULL,
    song_difficulty_id BIGINT       NOT NULL,
    event_type         VARCHAR(10)  NOT NULL,
    event_date         DATE         NOT NULL,
    average_level      DECIMAL(5,2) NULL,
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (setlist_event_id),
    UNIQUE KEY uq_setlist_event_day (user_id, song_difficulty_id, event_type, event_date),
    KEY ix_setlist_event_chart (song_difficulty_id, event_type),
    CONSTRAINT fk_setlist_event_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_setlist_event_song_difficulty FOREIGN KEY (song_difficulty_id) REFERENCES song_difficulties (song_difficulty_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
