/**
 * 용어 도움말(?)의 짧은 설명. 문구는 설명서(/guide)와 같은 뜻이어야 한다.
 * 화면에는 키만 넘기고 문구는 여기서 한곳에 모아 둔다(같은 용어를 여러 화면이 같은 말로 설명하게).
 */
export type TermKey = "single" | "other" | "ratingConstant";

export interface TermHelp {
  /** 팝오버 제목 (예: "레이팅 목록이 뭔가요?") */
  title: string;
  /** 한두 줄 설명 */
  lines: readonly string[];
}

export const TERM_HELP: Record<TermKey, TermHelp> = {
  single: {
    title: "단일이 뭔가요?",
    lines: ["단일 코드로 이루어진 채보입니다. 이 중 점수가 높은 15개가 레이팅에 들어갑니다."],
  },
  other: {
    title: "복합·이중·삼중이 뭔가요?",
    lines: ["2중, 3중 코드로 이루어진 곡, 종합적으로 요구하는 곡은 복합으로 분류됩니다. 이 중 점수가 높은 25개가 레이팅에 들어갑니다."],
  },
  ratingConstant: {
    title: "레이팅 상수 난이도가 뭔가요?",
    lines: [
      "서열표가 정한 채보의 기준 난이도입니다. 레벨 숫자가 아니라 이 값으로 곡 점수를 계산합니다.",
      "비어 있으면(미정) 레이팅에서 빠지고 기록만 남습니다.",
    ],
  },
};
