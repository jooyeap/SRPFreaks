/**
 * 백엔드 API가 주고받는 값의 타입.
 * 문자열 리터럴 유니온("A" | "B")은 "이 중 하나만 가능하다"고 컴파일러에게 알려 주는 TypeScript의 방법이다.
 * any 대신 이런 타입을 쓰면 오타(예: "GUTAR")를 코드를 돌리기 전에 잡아 준다.
 */

/** 파트. 화면 표기는 Guitar / Bass (format.ts의 partLabel). */
export type InstrumentPart = "GUITAR" | "BASS";

/** 난이도 종류. 화면 표기는 BAS / ADV / EXT / MAS (format.ts의 difficultyLabel). */
export type DifficultyType = "BASIC" | "ADVANCED" | "EXTREME" | "MASTER";

/** 노트 옵션. 지금 기록으로 받는 값은 SUPER_RANDOM_PLUS 하나다 (D25). */
export type NoteOption = "NORMAL" | "RANDOM" | "SUPER_RANDOM" | "RANDOM_PLUS" | "SUPER_RANDOM_PLUS";

/** 달성 단계. 낮은 단계 -> 높은 단계 순서다 (D24). */
export type AchievementStage = "C" | "B" | "A" | "S" | "SS" | "FC" | "EXC";
