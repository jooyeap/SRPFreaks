-- 같은 티어 유저 기록(D53)의 표시 기준. 숫자는 ROOT가 설정 화면에서 바꾼다(배포 불필요).
--   peer.min_band_users  : 내 티어 구간에 스냅샷을 가진 공개 유저가 이 수 이상이어야 보여 준다.
--   peer.min_chart_users : 한 채보를 레이팅 목록에 넣은 유저가 이 수 이상이어야 그 채보 줄을 보여 준다.
-- 값이 작으면 우연의 영향이 커지므로(5명 중 4명 같은) 화면에는 항상 몇 명 기준인지 함께 보여 준다.
-- 기준을 크게 올리면(예: 100000) 사실상 기능이 꺼진다 -> 문제가 보이면 설정만으로 되돌릴 수 있다.
INSERT INTO app_settings (setting_key, setting_value, updated_by, updated_at) VALUES
    ('peer.min_band_users',  '5', NULL, UTC_TIMESTAMP(6)),
    ('peer.min_chart_users', '5', NULL, UTC_TIMESTAMP(6));
