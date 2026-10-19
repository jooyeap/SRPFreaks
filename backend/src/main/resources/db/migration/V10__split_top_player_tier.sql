-- D38: 플레이어 티어 최상위를 나눈다. 기존 하수봉(9,500~) 한 티어 -> Iridescent(9,500) / Alien(10,000) / HSB(11,000).
-- 순서가 중요하다: min_score에 UNIQUE 제약(uk_player_tiers_min_score)이 있어서, 먼저 HASUBONG 행을 11,000으로 옮겨
-- 9,500 자리를 비운 뒤에 새 두 행을 넣는다. 티어는 저장하지 않고 합계로 계산하므로(D18) 사용자 데이터 이전은 없다.
UPDATE player_tiers
   SET tier_key = 'HSB', display_name = 'HSB', min_score = 11000, sort_order = 22
 WHERE tier_key = 'HASUBONG';

INSERT INTO player_tiers (tier_key, display_name, min_score, sort_order) VALUES
    ('IRIDESCENT', 'Iridescent',  9500, 20),
    ('ALIEN',      'Alien',      10000, 21);
