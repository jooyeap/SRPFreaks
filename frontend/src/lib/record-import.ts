import { apiFetch } from "@/lib/api";
import type { ReadPlay } from "@/lib/import-bookmarklet";
import { achievementStage } from "@/lib/stage";
import type { AchievementStage } from "@/lib/types";

/**
 * 최근 플레이 가져오기 화면용 API와 표시 규칙 (D40).
 * 공식 페이지의 북마클릿은 읽은 값을 이 사이트로 넘기기만 하고, 확인(preview)과 저장(commit)은 로그인한 계정으로 여기서 한다.
 */

/** 서버 ImportSkipReason과 같은 이름. 서버가 이름을 바꾸면 이 표도 같이 바꾼다. */
export type ImportSkipReason =
  | "UNSUPPORTED_GAME_TYPE"
  | "TRANSLATED_PAGE"
  | "OPTION_NOT_SUPPORTED"
  | "UNKNOWN_DIFFICULTY"
  | "SONG_NOT_FOUND"
  | "AMBIGUOUS_SONG"
  | "INVALID_VALUE"
  | "LOWER_THAN_BEST"
  | "NOT_IMPROVED";

export interface ImportPlayResult {
  /** 요청 plays의 순서(0부터) */
  index: number;
  title: string;
  /** 미리보기에서는 "저장하게 될 것", 저장 응답에서는 "저장됨" */
  saved: boolean;
  reason: ImportSkipReason | null;
  /** 이 채보의 내 기존 최고 달성률. 기록이 없거나 곡을 못 찾았으면 null */
  previousBestRate: number | null;
}

export interface ImportResult {
  saved: number;
  skipped: number;
  skippedByReason: Partial<Record<ImportSkipReason, number>>;
  results: ImportPlayResult[];
  excludedSongs: string[];
}

export const SKIP_REASON_LABELS: Record<ImportSkipReason, string> = {
  UNSUPPORTED_GAME_TYPE: "기타/베이스가 아닌 플레이",
  TRANSLATED_PAGE: "번역된 페이지에서 읽음",
  OPTION_NOT_SUPPORTED: "옵션이 S.RANDOM+가 아님",
  UNKNOWN_DIFFICULTY: "지원하지 않는 난이도",
  SONG_NOT_FOUND: "곡 목록에 없음",
  AMBIGUOUS_SONG: "같은 이름의 곡이 여러 개",
  INVALID_VALUE: "값이 올바르지 않음",
  LOWER_THAN_BEST: "기존 기록보다 낮음",
  NOT_IMPROVED: "기존 기록과 같음",
};

/** 곡 목록에 없어서 "제외"로 보여 주는 사유(나머지는 "건너뜀"). 제외한 곡은 곡 추가 건의로 이어 준다. */
export function isExcludedReason(reason: ImportSkipReason | null): boolean {
  return reason === "SONG_NOT_FOUND" || reason === "AMBIGUOUS_SONG";
}

export function previewRecentPlays(plays: ReadPlay[]): Promise<ImportResult> {
  return apiFetch<ImportResult>("/record-imports/preview", { method: "POST", body: { plays } });
}

export function commitRecentPlays(plays: ReadPlay[]): Promise<ImportResult> {
  return apiFetch<ImportResult>("/record-imports/commit", { method: "POST", body: { plays } });
}

/** 서버 ImportService.isFullCombo와 같은 규칙: MAX이거나 OK·MISS가 모두 0. 화면 표시용이고 저장 판정은 서버가 다시 한다. */
export function playFullCombo(play: ReadPlay): boolean {
  return play.rate >= 10000 || (play.miss === 0 && play.ok === 0);
}

/** 읽은 값(달성률 x100 정수)의 달성 단계. */
export function playStage(play: ReadPlay): AchievementStage {
  return achievementStage(play.rate / 100, playFullCombo(play)) ?? "C";
}

const DIFFICULTY_LABELS: Record<string, string> = { bsc: "BSC", adv: "ADV", ext: "EXT", mst: "MAS" };

/** 공식 난이도 클래스 → 파트·난이도 표기(`gf_mst` → Guitar / MAS, `bass_ext` → Bass / EXT). 모르는 클래스는 null. */
export function describePlayChart(difficultyClass: string): string | null {
  const m = /^(gf|bass)_(bsc|adv|ext|mst)$/.exec(difficultyClass);
  if (!m) return null;
  return `${m[1] === "gf" ? "Guitar" : "Bass"} | ${DIFFICULTY_LABELS[m[2]]}`;
}

/** 같은 플레이를 다시 받았는지 가르는 키. 공식 페이지의 플레이 시각 + 곡 + 난이도. */
export function playKey(play: ReadPlay): string {
  return `${play.playedAtMs}|${play.difficultyClass}|${play.title}`;
}
