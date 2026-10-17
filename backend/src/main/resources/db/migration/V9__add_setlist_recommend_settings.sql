-- 세트리스트 추천(D37)의 운영 설정. 수식의 모양은 코드에 있고 숫자만 여기서 읽는다(ROOT가 바꾼다).
-- recommend_range_ss : SS 도전 추천 범위. 내 평균 난이도 ± 이 값 안의 채보를 후보로 한다.
-- recommend_range_s  : S 채우기 추천 범위. SS 도전보다 넓게 잡는다(SS 도전 범위 이상이어야 한다).
-- recommend_min_entries : 평균 난이도를 구하려면 레이팅 목록에 최소 이 개수의 채보가 있어야 한다(모자라면 추천하지 않는다).
INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at) VALUES
    ('setlist.recommend_range_ss',    '0.3', NULL, UTC_TIMESTAMP(6)),
    ('setlist.recommend_range_s',     '0.5', NULL, UTC_TIMESTAMP(6)),
    ('setlist.recommend_min_entries', '10',  NULL, UTC_TIMESTAMP(6));
