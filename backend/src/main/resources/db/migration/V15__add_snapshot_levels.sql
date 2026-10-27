-- 레이팅 스냅샷에 "그 시점의 난이도"를 함께 남긴다 (D32 확장).
-- 서열표의 기준 난이도는 운영자가 고칠 수 있어서, 나중에 "이 레이팅대(평균 난이도)의 유저는 어떤 곡을 올렸나"를 집계하려면
-- 스냅샷을 만든 순간의 값이 필요하다. 이미 만든 스냅샷은 알 수 없으므로 NULL로 둔다(집계 때 제외한다).
--  - skill_snapshots.average_level      : 그 시점 레이팅 목록(단일+그 외)의 기준 난이도 평균, 소수 둘째 자리 반올림. 목록에 기준 난이도가 없으면 NULL
--  - skill_snapshot_entries.reference_level : 그 채보의 그 시점 서열표 기준 난이도(0.1 단위). 미정이면 NULL
ALTER TABLE skill_snapshots
    ADD COLUMN average_level DECIMAL(5,2) NULL AFTER other_score;

ALTER TABLE skill_snapshot_entries
    ADD COLUMN reference_level DECIMAL(3,1) NULL AFTER score;
