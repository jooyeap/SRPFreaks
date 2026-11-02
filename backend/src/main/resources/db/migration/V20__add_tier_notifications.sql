-- 서열표 변경 알림(D61). 설계는 docs/DESIGN.md 18.2.2.
--  - tier_notifications : 내가 기록한 채보의 기준 난이도가 바뀌어 "그 채보의 내 점수"가 달라졌을 때의 사이트 안 알림.
--                         라이벌 알림(rival_notifications)과 같은 알림 목록에 시간순으로 섞어 보여 준다.
--                         점수는 저장하지 않는다(읽을 때 before_tier/after_tier와 my_rate로 계산, 스킬 값은 계산 규칙).
--                         한 번 확인할 때 새 알림이 tier.notify_bundle_over건을 넘으면 한 줄(bundled)로 묶는다.
--  - users.tier_notify        : `서열표 변경 알림 받기`(기본 켜짐)
--  - users.tier_notify_cursor : 마지막으로 확인한 audit_logs.audit_log_id. 이 번호 이후의 로그만 알림 후보로 본다.
--                               NULL이면 "아직 시작 전"이라 처음 읽을 때 그 시점의 최대 번호로 채운다(과거 변경은 알리지 않음).
--  - 탈퇴·차단으로 사용자가 지워지면 CASCADE로 함께 지운다(D20).
CREATE TABLE tier_notifications (
    tier_notification_id BIGINT       NOT NULL AUTO_INCREMENT,
    user_id              BIGINT       NOT NULL,
    song_difficulty_id   BIGINT       NOT NULL,
    before_tier          DECIMAL(3,1) NULL,
    after_tier           DECIMAL(3,1) NULL,
    my_rate              DECIMAL(5,2) NOT NULL,
    bundled              BOOLEAN      NOT NULL DEFAULT FALSE,
    song_count           INT          NOT NULL DEFAULT 1,
    changed_at           DATETIME(6)  NOT NULL,
    created_at           DATETIME(6)  NOT NULL,
    read_at              DATETIME(6)  NULL,
    PRIMARY KEY (tier_notification_id),
    KEY ix_tier_noti_user (user_id, changed_at),
    KEY ix_tier_noti_created (created_at),
    CONSTRAINT fk_tier_noti_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_tier_noti_chart FOREIGN KEY (song_difficulty_id) REFERENCES song_difficulties (song_difficulty_id) ON DELETE CASCADE,
    CONSTRAINT ck_tier_noti_rate CHECK (my_rate BETWEEN 0 AND 100),
    CONSTRAINT ck_tier_noti_count CHECK (song_count >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
    ADD COLUMN tier_notify        BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN tier_notify_cursor BIGINT  NULL;

-- 기존 사용자는 "지금부터" 받는다. 적용 전의 서열표 변경이 한꺼번에 알림으로 쏟아지지 않게 커서를 지금의 최대 번호로 둔다.
UPDATE users SET tier_notify_cursor = (SELECT COALESCE(MAX(audit_log_id), 0) FROM audit_logs);

INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at) VALUES
    ('tier.notify_keep_days',   '30', NULL, UTC_TIMESTAMP(6)),
    ('tier.notify_bundle_over', '5',  NULL, UTC_TIMESTAMP(6));
