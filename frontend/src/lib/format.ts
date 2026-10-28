import type { DifficultyType, InstrumentPart } from "@/lib/types";
import type { Translator } from "@/i18n/translator";

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

/** 달성률 입력칸의 최댓값. 입력은 소수점 없는 정수(0~10000)이고 ÷100이 실제 달성률이다(9971 → 99.71). */
export const RATE_INPUT_MAX = 10000;

/**
 * 입력칸의 정수 글자를 달성률 숫자로 바꾼다. 정수 0~10000이 아니면 null.
 * - 기본: 100분의 1 단위 정수다. `"9971"` → 99.71, `"9650"` → 96.50, `"10000"` → 100.
 * - **정확히 세 자리**(앞자리가 0이 아닌)는 `96.5`를 점 없이 `965`로 치는 습관을 받아 주려고 끝에 0을 붙여 읽는다: `"965"` → 96.50.
 *   단 `"100"`은 100%로 친 것으로 보고 100.00으로 읽는다(10.00%가 아니다).
 * - 앞자리가 0이면(`"050"`) 붙이지 않고 글자 그대로 읽는다(0.50). 수정 창이 돌려주는 `"0500"`(5.00%)도 같은 이유로 4자리다.
 * 100으로 나누기 전에 정수 상태에서 범위를 보므로 부동소수점 오차가 끼지 않는다.
 */
export function rateFromInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,5}$/.test(trimmed)) {
    return null;
  }
  const typed = Number(trimmed);
  if (typed > RATE_INPUT_MAX) {
    return null;
  }
  let hundredths = typed;
  if (trimmed.length === 3 && trimmed[0] !== "0") {
    hundredths = typed === 100 ? RATE_INPUT_MAX : typed * 10;
  }
  return hundredths / 100;
}

/**
 * 달성률 숫자(99.71)를 입력칸의 정수 글자("9971")로 바꾼다(수정 창의 초기값).
 * 1.00~9.99%는 100분의 1 단위로 세 자리가 되는데, 세 자리는 입력 규칙상 끝에 0이 붙어 다른 값으로 읽히므로
 * 앞에 0을 붙여 네 자리로 돌려준다(5.00% → "0500"). 그래야 열었다가 저장해도 값이 바뀌지 않는다.
 */
export function rateToInput(rate: number): string {
  const text = String(Math.round(rate * 100));
  return text.length === 3 ? `0${text}` : text;
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

/** 서열표 기준 난이도 표기: 0.1 단위 (6 -> "6.0"). 값이 없으면 `미정`(번역 함수가 언어에 맞게 돌려준다). */
export function formatTier(tier: number | null | undefined, t: Translator): string {
  if (tier === null || tier === undefined || !Number.isFinite(tier)) {
    return t("Common.undecided");
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

const seoulTimeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** UTC 시간을 Asia/Seoul의 `2026-10-27 22:40`(24시간제)으로 보여 준다. 감사 로그처럼 같은 날 여러 건을 구분할 때 쓴다. 올바르지 않으면 `–`. */
export function formatSeoulDateTime(iso: string | null | undefined): string {
  const day = formatPlayedDate(iso);
  if (day === EMPTY_MARK || !iso) {
    return EMPTY_MARK;
  }
  const parts = Object.fromEntries(seoulTimeParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${day} ${parts.hour}:${parts.minute}`;
}
