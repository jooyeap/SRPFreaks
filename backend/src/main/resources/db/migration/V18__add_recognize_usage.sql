-- 사진 입력(D55) 사용량과 설정. 사진·인식 결과는 어디에도 저장하지 않고, 한도를 세기 위해 "언제 인식했는지"만 남긴다.
--  - recognize_usages : 인식을 요청할 때마다 한 줄(실패해도 센다). 8일 지난 줄은 지운다(7일 한도 + 하루 여유). 탈퇴하면 함께 삭제(D20).
--  - recognize.enabled          : 끄는 스위치. 기본 꺼짐(배포 후 ROOT가 켠다).
--  - recognize.min_role         : 누가 쓸 수 있는지. ADMIN(시험 기간: ROOT·ADMIN) / USER(모든 로그인 사용자). 공개 전환은 이 값만 바꾼다.
--  - recognize.weekly_limit     : 사용자당 최근 7일 장수.
--  - recognize.daily_total_limit: 전체 하루(서울 날짜) 장수. 비용 상한.
CREATE TABLE recognize_usages (
    recognize_usage_id BIGINT      NOT NULL AUTO_INCREMENT,
    user_id            BIGINT      NOT NULL,
    used_at            DATETIME(6) NOT NULL,
    PRIMARY KEY (recognize_usage_id),
    KEY ix_recognize_usage_user (user_id, used_at),
    KEY ix_recognize_usage_time (used_at),
    CONSTRAINT fk_recognize_usage_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at) VALUES
    ('recognize.enabled',           'false', NULL, UTC_TIMESTAMP(6)),
    ('recognize.min_role',          'ADMIN', NULL, UTC_TIMESTAMP(6)),
    ('recognize.weekly_limit',      '30',    NULL, UTC_TIMESTAMP(6)),
    ('recognize.daily_total_limit', '300',   NULL, UTC_TIMESTAMP(6));
