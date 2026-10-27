/**
 * 용어 도움말(?)의 짧은 설명. 문구는 설명서(/guide)와 같은 뜻이어야 한다.
 * 화면에는 키만 넘기고 문구는 여기서 한곳에 모아 둔다(같은 용어를 여러 화면이 같은 말로 설명하게).
 */
export type TermKey = "single" | "other" | "ratingConstant" | "peerStats";

/**
 * 용어마다 팝오버 제목 1개와 설명 줄들. 값은 문구 자체가 아니라 messages의 `TermHelp` 아래 번역 키다
 * (한국어·일본어 문구는 messages/ko.json, ja.json에 있다).
 */
export const TERM_HELP = {
  single: { title: "single.title", lines: ["single.line1"] },
  other: { title: "other.title", lines: ["other.line1"] },
  ratingConstant: { title: "ratingConstant.title", lines: ["ratingConstant.line1", "ratingConstant.line2"] },
  peerStats: { title: "peerStats.title", lines: ["peerStats.line1", "peerStats.line2", "peerStats.line3", "peerStats.line4"] },
} as const;
