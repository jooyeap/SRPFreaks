import type { DifficultyType, InstrumentPart } from "@/lib/types";

/** 값이 없을 때(기록 없음 등) 화면에 쓰는 표시 */
export const EMPTY_MARK = "–";

/**
 * 달성률을 100배 한 정수로 바꾼다 (예: 94.99 -> 9499).
 * 소수(부동소수점)는 컴퓨터가 정확히 저장하지 못해서 94.99 * 100이 9498.999...로 나올 수 있다.
 * Math.round로 가까운 정수로 맞춘 뒤 비교하면 "94.99는 95 미만" 같은 경계 판정이 어긋나지 않는다.
 * 숫자가 아니거나 무한대이면 null.
 */
export function toHundredths(rate: number): number | null {
  return Number.isFinite(rate) ? Math.round(rate * 100) : null;
}

/**
 * 달성률 표시: 100.00 이상은 `MAX`, 그 외는 소수점 둘째 자리까지 (86.78, 95.50).
 * 기록이 없거나(null/undefined) 숫자가 아니면 `–`.
 */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) {
    return EMPTY_MARK;
  }
  const hundredths = toHundredths(rate);
  if (hundredths === null) {
    return EMPTY_MARK;
  }
  return hundredths >= 10000 ? "MAX" : (hundredths / 100).toFixed(2);
}

/** 파트 표기: Guitar / Bass (GT/BA 같은 축약형은 쓰지 않는다). */
export function partLabel(part: InstrumentPart): string {
  return part === "GUITAR" ? "Guitar" : "Bass";
}

const DIFFICULTY_LABELS: Record<DifficultyType, string> = {
  BASIC: "BAS",
  ADVANCED: "ADV",
  EXTREME: "EXT",
  MASTER: "MAS",
};

/** 난이도 표기: BAS / ADV / EXT / MAS. */
export function difficultyLabel(difficulty: DifficultyType): string {
  return DIFFICULTY_LABELS[difficulty];
}

/** 서열표 기준 난이도 표기: 0.1 단위 (6 -> "6.0"). 값이 없으면 `미정`. */
export function formatTier(tier: number | null | undefined): string {
  if (tier === null || tier === undefined || !Number.isFinite(tier)) {
    return "미정";
  }
  return tier.toFixed(1);
}

/** 레벨 표기: 소수 둘째 자리 (9.8 -> "9.80"). */
export function formatLevel(level: number): string {
  return Number.isFinite(level) ? level.toFixed(2) : EMPTY_MARK;
}

/** 점수 표기: 소수 둘째 자리 (304 -> "304.00"). 서버가 이미 반올림해서 보내므로 자리만 맞춘다. */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return EMPTY_MARK;
  }
  return score.toFixed(2);
}

const seoulDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * 서버가 주는 시간은 UTC(예: 2026-10-04T16:00:00Z)다. 화면에는 Asia/Seoul 날짜로 바꿔 `2026-10-05`처럼 보여 준다.
 * 올바르지 않은 날짜 문자열이면 `–`.
 */
export function formatPlayedDate(iso: string | null | undefined): string {
  if (!iso) {
    return EMPTY_MARK;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return EMPTY_MARK;
  }
  const parts = Object.fromEntries(seoulDateParts.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
