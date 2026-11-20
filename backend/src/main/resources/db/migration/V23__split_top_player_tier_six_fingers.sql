-- D87: 플레이어 티어 10,000 이상을 4단계로 다시 나눈다.
--   10,000 6 Fingers(신설) / 10,500 Mutant(신설) / 11,000 Alien(구간 이동) / 11,500 HSB(시작점 이동)
-- 순서가 중요하다: min_score에 UNIQUE 제약(uk_player_tiers_min_score)이 있어서 한 행씩 옮길 때마다 자리가 겹치면 안 된다.
--   1) HSB를 11,000 -> 11,500 (11,500은 비어 있다)
--   2) Alien을 10,000 -> 11,000 (1)에서 HSB가 비워 준 자리)
--   3) 비워진 10,000, 10,500 자리에 새 두 행을 넣는다
-- sort_order(UNIQUE 아님)도 같은 순서로 맞춘다: 6 Fingers 21, Mutant 22, Alien 23, HSB 24.
-- 티어는 저장하지 않고 합계로 계산하므로(D18) 사용자 데이터 이전은 없다. 11,000~11,499였던 사람은 Alien,
-- 10,000~10,999였던 사람은 6 Fingers 또는 Mutant로 표시가 바뀐다(사용자 승인, 2026-11-20).
UPDATE player_tiers
   SET min_score = 11500, sort_order = 24
 WHERE tier_key = 'HSB';

UPDATE player_tiers
   SET min_score = 11000, sort_order = 23
 WHERE tier_key = 'ALIEN';

INSERT INTO player_tiers (tier_key, display_name, min_score, sort_order) VALUES
    ('SIX_FINGERS', '6 Fingers', 10000, 21),
    ('MUTANT',      'Mutant',    10500, 22);
