-- 곡 추가 건의에 요청하는 채보(파트·난이도)를 같이 보낸다. 최근 플레이 가져오기에서 곡이 목록에 없어 제외됐을 때,
-- 어느 파트·난이도 플레이였는지를 건의에 붙여 관리자가 바로 등록 창을 채워 열 수 있게 하려는 것이다(D35).
-- 둘 다 NULL(일반 건의) 이거나 둘 다 값이 있다. 값은 enum 이름(InstrumentPart, DifficultyType)을 VARCHAR로 넣는다.
ALTER TABLE suggestions
    ADD COLUMN requested_part       VARCHAR(10) NULL AFTER content,
    ADD COLUMN requested_difficulty VARCHAR(10) NULL AFTER requested_part;
