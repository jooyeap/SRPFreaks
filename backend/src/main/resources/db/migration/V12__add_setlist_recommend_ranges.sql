-- 세트리스트 추천 범위의 사용자별 설정 (D37). 없으면 서버 기본값(app_settings의 setlist.recommend_*)을 쓴다.
-- 값은 내 평균 난이도 대비 차이(음수 = 평균보다 쉬운 곡)이고, 하한 <= 상한이다. 한 사용자에 한 줄(UNIQUE).
-- 검증은 화면(Zod) / 서버(Validation) / DB(CHECK) 세 곳에서 한다. 탈퇴하면 같이 지워진다(D20, ON DELETE CASCADE).
CREATE TABLE setlist_recommend_ranges (
    setlist_recommend_range_id BIGINT       NOT NULL AUTO_INCREMENT,
    user_id                    BIGINT       NOT NULL,
    ss_min                     DECIMAL(4,2) NOT NULL,
    ss_max                     DECIMAL(4,2) NOT NULL,
    s_min                      DECIMAL(4,2) NOT NULL,
    s_max                      DECIMAL(4,2) NOT NULL,
    created_at                 DATETIME(6)  NOT NULL,
    updated_at                 DATETIME(6)  NOT NULL,
    PRIMARY KEY (setlist_recommend_range_id),
    UNIQUE KEY uq_recommend_range_user (user_id),
    CONSTRAINT fk_recommend_range_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT ck_recommend_range_order CHECK (ss_min <= ss_max AND s_min <= s_max),
    CONSTRAINT ck_recommend_range_bounds CHECK (
        ss_min BETWEEN -3.00 AND 3.00 AND ss_max BETWEEN -3.00 AND 3.00
        AND s_min BETWEEN -3.00 AND 3.00 AND s_max BETWEEN -3.00 AND 3.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
