-- SRPFreaks V1 스키마 (배포 전까지는 이 파일을 직접 고친다. 로컬 DB는 `docker compose down -v`로 초기화)
-- 규칙: PK = {테이블 단수형}_id, FK = 참조하는 PK와 같은 이름, 시간은 모두 DATETIME(6) UTC, enum은 VARCHAR 저장.
-- 설계: docs/DESIGN.md 6장. 기록은 소프트 삭제하지 않는다(삭제/탈퇴 = 완전 삭제, D20).

-- ---------------------------------------------------------------- 사용자 (Google 로그인, D19)
CREATE TABLE users (
    user_id      BIGINT       NOT NULL AUTO_INCREMENT,
    google_sub   VARCHAR(64)  NOT NULL,
    email        VARCHAR(255) NOT NULL,
    nickname     VARCHAR(30)  NULL,
    role         VARCHAR(20)  NOT NULL DEFAULT 'USER',      -- ROOT / ADMIN / USER
    status       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',    -- ACTIVE / BLOCKED
    created_at   DATETIME(6)  NOT NULL,
    updated_at   DATETIME(6)  NOT NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_users_google_sub (google_sub),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
    refresh_token_id BIGINT      NOT NULL AUTO_INCREMENT,
    user_id          BIGINT      NOT NULL,
    family_id        CHAR(36)    NOT NULL,                  -- 로그인 1회당 1개 (재사용 탐지)
    token_hash       CHAR(64)    NOT NULL,                  -- SHA-256 해시만 저장
    expires_at       DATETIME(6) NOT NULL,
    revoked_at       DATETIME(6) NULL,
    created_at       DATETIME(6) NOT NULL,
    PRIMARY KEY (refresh_token_id),
    UNIQUE KEY uk_refresh_tokens_token_hash (token_hash),
    KEY ix_refresh_tokens_user (user_id),
    KEY ix_refresh_tokens_family (family_id),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- 곡 / 채보
CREATE TABLE songs (
    song_id       BIGINT       NOT NULL AUTO_INCREMENT,
    title         VARCHAR(255) NOT NULL,
    artist        VARCHAR(255) NULL,
    added_version VARCHAR(30)  NULL,                        -- 초출 버전. 표시·분류용
    title_folder  VARCHAR(5)   NULL,                        -- 게임 안 타이틀 폴더(초성)
    bpm_min       INT          NULL,
    bpm_max       INT          NULL,
    image_url     VARCHAR(500) NULL,                        -- 기본 NULL, 설정 ui.show_song_images가 켜져 있을 때만 사용 (D7, D21)
    source        VARCHAR(100) NULL,                        -- 예: sheet-v1.1
    created_by    BIGINT       NULL,
    is_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (song_id),
    KEY ix_songs_title (title),
    CONSTRAINT fk_songs_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 곡명 표기·별칭 (검색, 매칭용). 매칭은 normalized_title로 한다 (NFKC, 공백 제거, 소문자)
CREATE TABLE song_titles (
    song_title_id    BIGINT       NOT NULL AUTO_INCREMENT,
    song_id          BIGINT       NOT NULL,
    kind             VARCHAR(20)  NOT NULL,                 -- ROMAJI / KANA / KO / ALIAS
    title            VARCHAR(255) NOT NULL,
    normalized_title VARCHAR(255) NOT NULL,
    PRIMARY KEY (song_title_id),
    UNIQUE KEY uk_song_titles (song_id, kind, normalized_title),
    KEY ix_song_titles_normalized (normalized_title),
    CONSTRAINT fk_song_titles_song FOREIGN KEY (song_id) REFERENCES songs (song_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE song_difficulties (
    song_difficulty_id BIGINT       NOT NULL AUTO_INCREMENT,
    song_id            BIGINT       NOT NULL,
    instrument_part    VARCHAR(10)  NOT NULL,               -- GUITAR / BASS
    difficulty_type    VARCHAR(20)  NOT NULL,               -- BASIC / ADVANCED / EXTREME / MASTER
    level              DECIMAL(3,2) NOT NULL,               -- 예: 9.85
    note_count         INT          NULL,
    is_deleted         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (song_difficulty_id),
    UNIQUE KEY uk_song_difficulties (song_id, instrument_part, difficulty_type),
    CONSTRAINT fk_song_difficulties_song FOREIGN KEY (song_id) REFERENCES songs (song_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- 옵션 기록 (유저 입력, 계속 쌓인다)
CREATE TABLE option_records (
    option_record_id   BIGINT       NOT NULL AUTO_INCREMENT,
    user_id            BIGINT       NOT NULL,
    song_difficulty_id BIGINT       NOT NULL,
    note_option        VARCHAR(20)  NOT NULL,               -- NORMAL / RANDOM / SUPER_RANDOM / RANDOM_PLUS / SUPER_RANDOM_PLUS
    achievement_rate   DECIMAL(5,2) NOT NULL,
    is_full_combo      BOOLEAN      NOT NULL DEFAULT FALSE, -- 달성률 100.00이면 true로 저장
    played_at          DATETIME(6)  NOT NULL,               -- 입력하지 않으면 저장 시각
    platform           VARCHAR(10)  NULL,                   -- ARCADE / KONASTE (확장용)
    memo               VARCHAR(255) NULL,
    extra_options      JSON         NULL,                   -- 이후 추가될 옵션용
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (option_record_id),
    KEY ix_option_records_best (user_id, song_difficulty_id, note_option, achievement_rate DESC),
    KEY ix_option_records_recent (user_id, played_at DESC),
    CONSTRAINT fk_option_records_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_option_records_difficulty FOREIGN KEY (song_difficulty_id) REFERENCES song_difficulties (song_difficulty_id),
    CONSTRAINT ck_option_records_rate CHECK (achievement_rate BETWEEN 0.00 AND 100.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- 난이도표 (SRN+ 서열표가 첫 사례, D8)
CREATE TABLE difficulty_tables (
    difficulty_table_id BIGINT       NOT NULL AUTO_INCREMENT,
    name                VARCHAR(100) NOT NULL,
    instrument_part     VARCHAR(10)  NULL,                  -- NULL = 기타·베이스 모두
    note_option         VARCHAR(20)  NOT NULL,              -- 서열표 기준 옵션
    status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    revision            INT          NOT NULL DEFAULT 1,
    created_at          DATETIME(6)  NOT NULL,
    updated_at          DATETIME(6)  NOT NULL,
    PRIMARY KEY (difficulty_table_id),
    UNIQUE KEY uk_difficulty_tables_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE difficulty_table_entries (
    difficulty_table_entry_id BIGINT       NOT NULL AUTO_INCREMENT,
    difficulty_table_id       BIGINT       NOT NULL,
    song_difficulty_id        BIGINT       NOT NULL,
    tier_label                DECIMAL(3,1) NULL,            -- 기준 난이도. NULL = 미정 (레이팅 계산에서 제외)
    tier_uncertain            BOOLEAN      NOT NULL DEFAULT FALSE,
    tier_order                INT          NULL,
    recommend                 VARCHAR(10)  NULL,            -- 상 / 중 / 하
    recommend_uncertain       BOOLEAN      NOT NULL DEFAULT FALSE,
    pattern_type              VARCHAR(20)  NULL,            -- 단일 / 복합 / 이중 / 삼중 / 레이팅 제외 (NULL도 제외)
    pattern_uncertain         BOOLEAN      NOT NULL DEFAULT FALSE,
    comment                   VARCHAR(255) NULL,
    created_at                DATETIME(6)  NOT NULL,
    updated_at                DATETIME(6)  NOT NULL,
    PRIMARY KEY (difficulty_table_entry_id),
    UNIQUE KEY uk_difficulty_table_entries (difficulty_table_id, song_difficulty_id),
    KEY ix_difficulty_table_entries_tier (difficulty_table_id, tier_label),
    CONSTRAINT fk_dte_table FOREIGN KEY (difficulty_table_id) REFERENCES difficulty_tables (difficulty_table_id) ON DELETE CASCADE,
    CONSTRAINT fk_dte_difficulty FOREIGN KEY (song_difficulty_id) REFERENCES song_difficulties (song_difficulty_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- 플레이어 티어 (D18)
-- 합계의 정수부 >= min_score 인 행 중 가장 큰 것이 티어. 값은 ROOT가 고친다.
CREATE TABLE player_tiers (
    player_tier_id BIGINT      NOT NULL AUTO_INCREMENT,
    tier_key       VARCHAR(30) NOT NULL,
    display_name   VARCHAR(30) NOT NULL,
    min_score      INT         NOT NULL,
    sort_order     INT         NOT NULL,
    PRIMARY KEY (player_tier_id),
    UNIQUE KEY uk_player_tiers_key (tier_key),
    UNIQUE KEY uk_player_tiers_min_score (min_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO player_tiers (tier_key, display_name, min_score, sort_order) VALUES
    ('WHITE',             'White',             0,    1),
    ('WHITE_GRADIENT',    'White Gradient',    500,  2),
    ('ORANGE',            'Orange',            1000, 3),
    ('ORANGE_GRADIENT',   'Orange Gradient',   1500, 4),
    ('YELLOW',            'Yellow',            2000, 5),
    ('YELLOW_GRADIENT',   'Yellow Gradient',   2500, 6),
    ('GREEN',             'Green',             3000, 7),
    ('GREEN_GRADIENT',    'Green Gradient',    3500, 8),
    ('BLUE',              'Blue',              4000, 9),
    ('BLUE_GRADIENT',     'Blue Gradient',     4500, 10),
    ('PURPLE',            'Purple',            5000, 11),
    ('PURPLE_GRADIENT',   'Purple Gradient',   5500, 12),
    ('RED',               'Red',               6000, 13),
    ('RED_GRADIENT',      'Red Gradient',      6500, 14),
    ('BRONZE',            'Bronze',            7000, 15),
    ('SILVER',            'Silver',            7500, 16),
    ('GOLD',              'Gold',              8000, 17),
    ('RAINBOW',           'Rainbow',           8500, 18),
    ('RAINBOW_GRADIENT',  'Rainbow Gradient',  9000, 19),
    ('HASUBONG',          '하수봉',             9500, 20);

-- ---------------------------------------------------------------- 설정 / 감사 로그
CREATE TABLE app_settings (
    setting_key   VARCHAR(50)  NOT NULL,
    setting_value VARCHAR(500) NOT NULL,
    updated_by    BIGINT       NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (setting_key),
    CONSTRAINT fk_app_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 레이팅 수식 계수 (7장): R = T > pivot ? high_slope*T - high_offset : low_slope*T - low_offset  (T = 기준 난이도)
--                       V = R*min(A, cap_rate)/100 + bonus*min(max(A - cap_rate, 0), max_rate - cap_rate)/(max_rate - cap_rate), 점수 = V * score_multiplier
INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at) VALUES
    ('rating.pivot',            '6.0', NULL, UTC_TIMESTAMP(6)),
    ('rating.high_slope',       '5',   NULL, UTC_TIMESTAMP(6)),
    ('rating.high_offset',      '15',  NULL, UTC_TIMESTAMP(6)),
    ('rating.low_slope',        '10',  NULL, UTC_TIMESTAMP(6)),
    ('rating.low_offset',       '45',  NULL, UTC_TIMESTAMP(6)),
    ('rating.cap_rate',         '80',  NULL, UTC_TIMESTAMP(6)),
    ('rating.max_rate',         '95',  NULL, UTC_TIMESTAMP(6)),
    ('rating.bonus',            '3.2', NULL, UTC_TIMESTAMP(6)),
    ('rating.score_multiplier', '20',  NULL, UTC_TIMESTAMP(6)),
    ('rating.list_single',      '15',  NULL, UTC_TIMESTAMP(6)),
    ('rating.list_other',       '25',  NULL, UTC_TIMESTAMP(6)),
    ('rating.note_option',      'SUPER_RANDOM_PLUS', NULL, UTC_TIMESTAMP(6)),
    ('ui.show_song_images',     'false', NULL, UTC_TIMESTAMP(6)),
    ('contact.takedown_email',  'eyoung071212@gmail.com', NULL, UTC_TIMESTAMP(6));

CREATE TABLE audit_logs (
    audit_log_id BIGINT       NOT NULL AUTO_INCREMENT,
    actor_id     BIGINT       NULL,                          -- 탈퇴하면 NULL로 바뀐다 (D20)
    action       VARCHAR(50)  NOT NULL,
    target_type  VARCHAR(50)  NULL,
    target_id    VARCHAR(64)  NULL,
    detail       JSON         NULL,
    created_at   DATETIME(6)  NOT NULL,
    PRIMARY KEY (audit_log_id),
    KEY ix_audit_logs_created (created_at),
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
