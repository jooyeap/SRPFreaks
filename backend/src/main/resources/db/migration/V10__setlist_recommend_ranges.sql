-- 세트리스트 추천(D37) 규칙 변경: 평균 ± 대칭 범위를 버리고, 묶음마다 "평균 대비 하한~상한" 범위를 둔다.
--   SS 기준 : 평균보다 쉬운 쪽에서 SS를 노린다(기본 -0.6 ~ -0.1)
--   S 기준  : 평균 근처에서 위쪽으로 S를 채운다(기본 -0.1 ~ +0.4)
-- 추정 근거가 되는 레이팅 목록의 최소 개수는 합계 기준(recommend_min_entries)에서 그룹별(단일 / 그 외)로 바꾼다.
--   단일 상위 15의 1/3 = 5, 그 외 상위 25의 1/3 = 9 (올림). 어느 한쪽이라도 모자라면 "데이터가 적다" 안내만 보인다.
-- starter_tier : 레이팅 목록이 비어 있는 신규 사용자에게는 이 기준 난이도 이하의 S 기준 곡만 보여 준다.
-- 이 단계에서 값은 모두에게 같다(ROOT가 바꾼다). 사용자별 조정은 다음 단계.
DELETE FROM app_settings
 WHERE setting_key IN ('setlist.recommend_range_ss', 'setlist.recommend_range_s', 'setlist.recommend_min_entries');

INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at) VALUES
    ('setlist.recommend_ss_min',      '-0.6', NULL, UTC_TIMESTAMP(6)),
    ('setlist.recommend_ss_max',      '-0.1', NULL, UTC_TIMESTAMP(6)),
    ('setlist.recommend_s_min',       '-0.1', NULL, UTC_TIMESTAMP(6)),
    ('setlist.recommend_s_max',       '0.4',  NULL, UTC_TIMESTAMP(6)),
    ('setlist.recommend_min_single',  '5',    NULL, UTC_TIMESTAMP(6)),
    ('setlist.recommend_min_other',   '9',    NULL, UTC_TIMESTAMP(6)),
    ('setlist.recommend_starter_tier', '5.2', NULL, UTC_TIMESTAMP(6));
