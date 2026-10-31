-- 라이벌(D56). 설계는 docs/DESIGN.md 18.2.1.
--  - rivals              : 내가 등록한 라이벌(최대 rival.max_count명). 양쪽에 줄이 있으면 "서로 라이벌"이다.
--  - rival_notifications : 서로 라이벌이 내가 이기고 있던 채보를 넘었을 때의 사이트 안 알림.
--                          PENDING(저장 10분 뒤 다시 확인 전) -> SHOWN. 닉네임·곡명은 저장하지 않고 읽을 때 붙인다.
--  - 탈퇴·차단으로 사용자가 지워지면 CASCADE로 함께 지운다(D20).
CREATE TABLE rivals (
    rival_id       BIGINT      NOT NULL AUTO_INCREMENT,
    user_id        BIGINT      NOT NULL,
    target_user_id BIGINT      NOT NULL,
    created_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (rival_id),
    UNIQUE KEY uk_rival_user_target (user_id, target_user_id),
    KEY ix_rival_target (target_user_id, user_id),
    CONSTRAINT fk_rival_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rival_target FOREIGN KEY (target_user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT ck_rival_not_self CHECK (user_id <> target_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rival_notifications (
    rival_notification_id BIGINT       NOT NULL AUTO_INCREMENT,
    recipient_user_id     BIGINT       NOT NULL,
    actor_user_id         BIGINT       NOT NULL,
    song_difficulty_id    BIGINT       NOT NULL,
    actor_rate            DECIMAL(5,2) NOT NULL,
    recipient_rate        DECIMAL(5,2) NOT NULL,
    status                VARCHAR(10)  NOT NULL,
    bundled               BOOLEAN      NOT NULL DEFAULT FALSE,
    song_count            INT          NOT NULL DEFAULT 1,
    alert_date            DATE         NULL,
    visible_at            DATETIME(6)  NOT NULL,
    created_at            DATETIME(6)  NOT NULL,
    read_at               DATETIME(6)  NULL,
    PRIMARY KEY (rival_notification_id),
    KEY ix_rival_noti_recipient (recipient_user_id, status, visible_at),
    KEY ix_rival_noti_created (created_at),
    CONSTRAINT fk_rival_noti_recipient FOREIGN KEY (recipient_user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rival_noti_actor FOREIGN KEY (actor_user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rival_noti_chart FOREIGN KEY (song_difficulty_id) REFERENCES song_difficulties (song_difficulty_id) ON DELETE CASCADE,
    CONSTRAINT ck_rival_noti_rates CHECK (actor_rate BETWEEN 0 AND 100 AND recipient_rate BETWEEN 0 AND 100),
    CONSTRAINT ck_rival_noti_count CHECK (song_count >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users ADD COLUMN rival_notify BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at) VALUES
    ('rival.max_count',              '5',  NULL, UTC_TIMESTAMP(6)),
    ('rival.notify_delay_minutes',   '10', NULL, UTC_TIMESTAMP(6)),
    ('rival.notify_daily_per_rival', '3',  NULL, UTC_TIMESTAMP(6)),
    ('rival.notify_keep_days',       '30', NULL, UTC_TIMESTAMP(6));
