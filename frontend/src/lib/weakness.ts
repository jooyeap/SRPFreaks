import { apiFetch } from "@/lib/api";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/**
 * 약점 분석 (D72, 서버 WeaknessAnalysisResponse와 같은 모양). 내 레이팅 목록(단일 15 + 그 외 25)과 같은 티어 공개 유저들의
 * 레이팅 목록(D53)을 같은 기준에서 속성별·난이도대별로 비교한 값이다. 유저 식별 정보나 개별 달성률은 오지 않는다(평균과 인원 수만).
 * 달성률 평균은 서버가 소수 둘째 자리로 반올림해 보내고, diff는 표시된 두 평균의 차(내 평균 − 같은 티어 평균)다.
 */
export type WeaknessPattern = "SINGLE" | "COMPOUND" | "DOUBLE" | "TRIPLE";

export interface WeaknessPatternRow {
  pattern: WeaknessPattern;
  /** 내 레이팅 목록에 있는 이 속성의 채보 수 */
  myCharts: number;
  myAvg: number | null;
  /** 같은 티어 평균. 비교할 수 없으면(인원 부족) null */
  peerAvg: number | null;
  peerUsers: number | null;
  diff: number | null;
}

export interface WeaknessBandRow {
  /** 묶음 시작 기준 난이도(예 5.5)와 끝(5.9) */
  tierFrom: number;
  tierTo: number;
  myCharts: number;
  myAvg: number | null;
  peerAvg: number | null;
  peerUsers: number | null;
  diff: number | null;
  /** 가장 약한 난이도대 */
  weak: boolean;
}

export interface WeaknessEasyChart {
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  tier: number | null;
  pattern: string | null;
  /** 내 최고 달성률. 기록이 없으면 null */
  currentRate: number | null;
  /** 같은 티어 유저 달성률 중앙값 */
  targetRate: number;
  /** 목표를 치면 오르는 내 점수 */
  expectedGain: number;
  peerUsers: number;
}

export interface WeaknessAnalysisResponse {
  tierName: string | null;
  bandUsers: number;
  /** false면 같은 티어 값이 모두 비어 있다 -> `비교 대상이 적어요` */
  peerAvailable: boolean;
  /** 같은 티어 최소 인원(설정 peer.min_band_users). 집계 메타 정보. 옛 응답에는 없을 수 있다 */
  minBandUsers?: number;
  minChartsPerBand: number;
  bandWidth: number;
  patterns: WeaknessPatternRow[];
  bands: WeaknessBandRow[];
  weakBandFrom: number | null;
  easyCharts: WeaknessEasyChart[];
}

/** 조회 키. 사용자마다 티어가 달라 결과가 다르므로 사용자 id를 키에 넣는다(로그아웃 뒤 다른 계정에 섞이지 않게). */
export const weaknessKeys = {
  all: ["weakness"] as const,
  me: (userId: number) => ["weakness", userId] as const,
};

export function fetchWeakness(signal?: AbortSignal): Promise<WeaknessAnalysisResponse> {
  return apiFetch<WeaknessAnalysisResponse>("/skills/me/weakness", { signal });
}

/** 서버의 속성 키를 화면 라벨 번역(patternLabel)이 쓰는 값(`단일` 등)으로 바꾼다. */
export function patternValue(pattern: WeaknessPattern): string {
  switch (pattern) {
    case "SINGLE":
      return "단일";
    case "COMPOUND":
      return "복합";
    case "DOUBLE":
      return "이중";
    case "TRIPLE":
      return "삼중";
  }
}

/**
 * 평균 달성률 차 표기(둘째 자리 %): 앞서면 `+2.35%`, 뒤지면 `−2.35%`(진짜 마이너스 기호 U+2212), 같으면 `±0.00%`. 값이 없으면 null.
 * 부호가 글자로 보이므로 색만으로 앞뒤를 구분하지 않는다. 서버 값은 소수 둘째 자리라 100을 곱해 정수로 맞춘 뒤 문자로 바꾼다(부동소수점 찌꺼기 방지).
 */
export function formatAvgDiff(diff: number | null | undefined): { text: string; sign: "up" | "down" | "even" } | null {
  if (diff === null || diff === undefined || !Number.isFinite(diff)) return null;
  const hundredths = Math.round(diff * 100);
  const abs = (Math.abs(hundredths) / 100).toFixed(2);
  if (hundredths > 0) return { text: `+${abs}%`, sign: "up" };
  if (hundredths < 0) return { text: `−${abs}%`, sign: "down" };
  return { text: "±0.00%", sign: "even" };
}

/** 분석 막대의 눈금 범위. 80 미만은 막대 길이 0(잘림)이고 눈금 숫자는 5 간격이다. */
export const SCALE_MIN = 80;
export const SCALE_MAX = 100;
export const SCALE_TICKS: readonly number[] = [80, 85, 90, 95, 100];

/**
 * 막대 길이(%) = (평균 달성률 − 80) / (100 − 80). 눈금이 0~100이 아니라 80~100이라 80 미만은 0, 100 이상은 100으로 자른다.
 * 값이 없으면(null) 0. 막대는 장식이고 정확한 값은 막대 오른쪽 글자가 담는다.
 */
export function scalePercent(avg: number | null): number {
  if (avg === null || !Number.isFinite(avg)) return 0;
  const ratio = ((avg - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  return Math.min(100, Math.max(0, ratio));
}

/** 난이도대 라벨: `5.5~5.9`. */
export function bandLabel(from: number, to: number): string {
  return `${from.toFixed(1)}~${to.toFixed(1)}`;
}

/** 내 레이팅 목록에 곡이 하나도 없으면 분석할 것이 없다. */
export function hasNoMine(data: WeaknessAnalysisResponse): boolean {
  return data.patterns.every((p) => p.myCharts === 0);
}
