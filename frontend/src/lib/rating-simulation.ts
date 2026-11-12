import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { formatRate, RATE_INPUT_MAX, rateFromInput } from "@/lib/format";
import type { DifficultyType, InstrumentPart } from "@/lib/types";
import type { Translator } from "@/i18n/translator";

/**
 * 곡 상세의 컷라인 · 목표 달성률 · 시뮬레이션 (D71, 서버 RatingSimulationResponse와 같은 모양).
 * **수식은 이 파일에 없다.** 컷라인, 필요 달성률, 순위, 총점 변화는 모두 서버(GET /skills/me/simulate)가 계산해서 주고,
 * 화면은 받은 값을 보여 주기만 한다(수식을 프론트에 복사하면 설정이 바뀔 때 두 곳이 어긋나기 때문이다).
 */
export type SimulationStatus = "IN_LIST" | "OUT_OF_LIST" | "NO_RECORD" | "NOT_RATED";
export type SimulationNotRatedReason = "TIER_UNDECIDED" | "EXCLUDED" | "NOT_RATED";
export type SimulationGroup = "SINGLE" | "OTHER";

export interface SimulationCutline {
  /** 그룹 마지막 곡의 점수. 그룹이 덜 찼으면 null */
  lastScore: number | null;
  /** 다른 곡 기준으로 이 채보가 목록에 들어가는 가장 낮은 달성률(둘째 자리). 100.00으로도 못 들어가면 null */
  requiredRate: number | null;
  reachable: boolean;
  /** requiredRate - 내 최고 달성률. 양수면 더 올려야 하고, 0 이하면 그만큼 여유. 기록이 없으면 null */
  rateGap: number | null;
  groupFull: boolean;
}

export interface SimulationPushedOut {
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  score: number;
}

export interface SimulationResult {
  /** 실제로 계산에 쓴 달성률(내 최고 기록보다 낮게 넣으면 최고 기록) */
  achievement: number;
  belowBest: boolean;
  entered: boolean;
  rank: number | null;
  scoreAfter: number;
  totalBefore: number;
  totalAfter: number;
  totalChange: number;
  pushedOut: SimulationPushedOut | null;
}

export interface RatingSimulationResponse {
  status: SimulationStatus;
  notRatedReason: SimulationNotRatedReason | null;
  group: SimulationGroup | null;
  groupLimit: number;
  groupSize: number;
  currentRate: number | null;
  currentScore: number | null;
  currentRank: number | null;
  cutline: SimulationCutline | null;
  simulation: SimulationResult | null;
}

/**
 * 조회 키. 앞부분이 "skill"이라 기록을 저장하면(AFFECTED_QUERY_KEYS의 ["skill"]) 같이 무효화되어 컷라인이 바로 갱신된다.
 * 사용자 id를 넣는 이유: 로그아웃 뒤 다른 계정에 이전 사용자의 계산 결과가 섞이지 않게 하려는 것이다.
 * hundredths = 목표 달성률을 100배 한 정수(9650 = 96.50). 없으면 컷라인만 묻는 요청이다.
 */
export const simulationKeys = {
  chart: (userId: number, chartId: number, hundredths: number | null) =>
    ["skill", userId, "simulation", chartId, hundredths] as const,
};

/** 컷라인만(achievement 없음) 또는 시뮬레이션까지(achievement 있음) 받는다. 로그인이 필요하다. */
export function fetchRatingSimulation(
  chartId: number,
  achievement: number | null,
  signal?: AbortSignal,
): Promise<RatingSimulationResponse> {
  return apiFetch<RatingSimulationResponse>("/skills/me/simulate", {
    query: { songDifficultyId: chartId, achievement: achievement === null ? undefined : achievement.toFixed(2) },
    signal,
  });
}

/** 빠른 칩. 입력칸 글자(소수점 없는 정수, 9500 = 95.00%)와 화면 글자. */
export const QUICK_RATES = [
  { input: "9500", label: "95%" },
  { input: "9700", label: "97%" },
  { input: "9900", label: "99%" },
  { input: String(RATE_INPUT_MAX), label: "MAX" },
] as const;

/** 입력 검사(Zod). 기록 입력(record-schema)과 같은 규칙·같은 문구를 쓴다: 소수점 없는 정수 0~10000, ÷100이 달성률. 서버(Validation)에도 같은 범위가 있다. */
export function makeSimulationSchema(t: Translator) {
  return z.object({
    achievementRate: z
      .string()
      .trim()
      .min(1, t("Validation.rateRequired"))
      .superRefine((value, ctx) => {
        if (value.length === 0) {
          return; // 위의 min이 이미 알린다
        }
        if (!/^\d{1,5}$/.test(value)) {
          ctx.addIssue({ code: "custom", message: t("Validation.rateNumber") });
          return;
        }
        if (Number(value) > RATE_INPUT_MAX) {
          ctx.addIssue({ code: "custom", message: t("Validation.rateRange") });
        }
      }),
  });
}

export type SimulationFormValues = z.infer<ReturnType<typeof makeSimulationSchema>>;

/** 입력 글자를 서버에 보낼 달성률로 바꾼다. 규칙에 맞지 않으면 null(요청하지 않는다). */
export function achievementFromInput(text: string): number | null {
  return rateFromInput(text);
}

/** 달성률 + 단위: 100.00은 `MAX`(그대로), 그 외는 둘째 자리까지 + `%`. */
export function rateWithUnit(rate: number): string {
  const text = formatRate(rate);
  return text === "MAX" ? text : `${text}%`;
}

/** `+1.50%` 꼴. 둘째 자리 기준으로 부호를 정한다(0이면 `0.00%`). */
export function gapWithUnit(gap: number): string {
  const cents = Math.round(gap * 100);
  return `${cents > 0 ? "+" : ""}${(cents / 100).toFixed(2)}%`;
}

/** 목표 달성률 입력칸의 처음 값(소수점 없는 정수 글자). 목록 밖·기록 없음이면 컷라인 달성률에서 시작하고, 이미 안이거나 못 들어가면 비운다. */
export function initialInput(data: RatingSimulationResponse): string {
  const required = data.cutline?.requiredRate ?? null;
  if ((data.status === "NO_RECORD" || data.status === "OUT_OF_LIST") && required !== null) {
    return String(Math.round(required * 100));
  }
  return "";
}

/** 진행 막대 비율(0~1): 내 달성률이 컷라인 달성률의 몇 %인가. 이미 안이거나 컷라인이 0이면 1, 기록이 없으면 0. */
export function cutlineProgress(data: RatingSimulationResponse): number {
  const required = data.cutline?.requiredRate ?? null;
  if (data.status === "IN_LIST" || required === 0) {
    return 1;
  }
  if (required === null || data.currentRate === null) {
    return 0;
  }
  return Math.min(Math.max(data.currentRate / required, 0), 1);
}
