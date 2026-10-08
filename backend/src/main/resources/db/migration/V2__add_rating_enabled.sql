-- 서열표 채보별 "레이팅 반영" 스위치. ROOT·ADMIN이 서열표 값 수정 창에서 켜고 끈다.
-- 꺼져 있으면 기준 난이도와 속성이 있어도 레이팅 목록에서 뺀다(기록은 그대로 남는다).
--
-- DEFAULT TRUE인 이유: 이 변경 전에 있던 줄과 시드 SQL로 넣는 줄은 "지금까지처럼" 계산에 들어가게 둔다.
-- 관리자 화면에서 새로 추가하는 줄만 앱(DifficultyTableEntry.create)이 꺼짐(FALSE)으로 시작시킨다.
ALTER TABLE difficulty_table_entries
    ADD COLUMN rating_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER pattern_uncertain;
