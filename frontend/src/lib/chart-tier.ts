import { chartScore } from "@/lib/rating-guide";

/**
 * 채보 한 곡의 점수를 플레이어 티어 색으로 칠하기 위한 계산.
 *
 * 생각: 레이팅은 40곡(단일 15 + 그 외 25)의 점수 합이고 티어는 그 합의 구간이다. 그래서 "이 곡 점수를 40곡 모두에서 냈다면
 * 어느 티어일까"를 곡 점수 = 티어 최소 점수 ÷ 40 으로 비교해 색을 고른다. 색 값은 globals.css의 `[data-tier="…"]`에 있고,
 * 여기서는 어느 티어인지(key)와 빛 단계(glow)만 정한다.
 *
 * 티어 최소 점수는 DB(player_tiers, V1 시드)의 값을 그대로 옮긴 것이다. 서버에서 ROOT가 구간표를 바꾸면 이 표도 같이 고쳐야 한다
 * (설명서 상수표처럼 로그인 없이 보는 화면이 있어 API로 읽지 않는다).
 */
export const PLAYER_TIER_MINS: readonly { key: string; name: string; min: number }[] = [
  { key: "WHITE", name: "White", min: 0 },
  { key: "WHITE_GRADIENT", name: "White Gradient", min: 500 },
  { key: "ORANGE", name: "Orange", min: 1000 },
  { key: "ORANGE_GRADIENT", name: "Orange Gradient", min: 1500 },
  { key: "YELLOW", name: "Yellow", min: 2000 },
  { key: "YELLOW_GRADIENT", name: "Yellow Gradient", min: 2500 },
  { key: "GREEN", name: "Green", min: 3000 },
  { key: "GREEN_GRADIENT", name: "Green Gradient", min: 3500 },
  { key: "BLUE", name: "Blue", min: 4000 },
  { key: "BLUE_GRADIENT", name: "Blue Gradient", min: 4500 },
  { key: "PURPLE", name: "Purple", min: 5000 },
  { key: "PURPLE_GRADIENT", name: "Purple Gradient", min: 5500 },
  { key: "RED", name: "Red", min: 6000 },
  { key: "RED_GRADIENT", name: "Red Gradient", min: 6500 },
  { key: "BRONZE", name: "Bronze", min: 7000 },
  { key: "SILVER", name: "Silver", min: 7500 },
  { key: "GOLD", name: "Gold", min: 8000 },
  { key: "RAINBOW", name: "Rainbow", min: 8500 },
  { key: "RAINBOW_GRADIENT", name: "Rainbow Gradient", min: 9000 },
  { key: "HASUBONG", name: "하수봉", min: 9500 },
];

/** 레이팅에 들어가는 채보 수: 단일 15 + 그 외 25 (rating.list_single + rating.list_other 기본값) */
export const RATED_CHART_COUNT = 40;

/** 곡 점수 기준의 티어 구간 시작점 (티어 최소 점수 ÷ 40). 하수봉은 237.5. */
export function chartTierStart(min: number): number {
  return min / RATED_CHART_COUNT;
}

/**
 * 최고 티어(하수봉) 구간 안의 단계 폭과 개수. 점수 대부분이 237.5 이상인 상수표 윗부분이 한 색으로만 보여서
 * (2026-10-10) 237.5부터 25점마다 단계를 올린다: 237.5 / 262.5 / 287.5 / 312.5 / 337.5 / 362.5 (최대 점수 384까지 6단계).
 * 단계마다 색(채움)과 빛이 달라서 색만 봐도 구간을 알 수 있다(globals.css의 [data-glow]).
 */
export const HASUBONG_BAND_STEP = 25;
export const HASUBONG_BAND_COUNT = 6;

export interface ChartTier {
  /** player_tiers의 tier_key. CSS `[data-tier]`가 색을 정한다 */
  key: string;
  /** 0 = 단계 없음. 최고 티어(하수봉) 구간에서만 1~6 (점수가 높을수록 높은 단계). CSS data-glow의 값이다 */
  glow: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** 점수(소수 그대로, 반올림 전)가 속한 티어와 빛 단계. 음수는 가장 낮은 티어로 본다. */
export function chartTier(score: number): ChartTier {
  let current = PLAYER_TIER_MINS[0];
  for (const tier of PLAYER_TIER_MINS) {
    if (score >= chartTierStart(tier.min)) {
      current = tier;
    }
  }
  const top = PLAYER_TIER_MINS[PLAYER_TIER_MINS.length - 1];
  if (current.key !== top.key) {
    return { key: current.key, glow: 0 };
  }
  const band = Math.floor((score - chartTierStart(top.min)) / HASUBONG_BAND_STEP) + 1;
  return { key: current.key, glow: Math.min(HASUBONG_BAND_COUNT, band) as ChartTier["glow"] };
}

/** 요소에 붙일 속성. CSS가 `data-tier`로 색을, `data-glow`로 빛 세기를 정한다. 빛이 없으면 data-glow는 붙이지 않는다. */
export function chartTierAttrs(score: number): { "data-tier": string; "data-glow"?: string } {
  const tier = chartTier(score);
  return tier.glow > 0 ? { "data-tier": tier.key, "data-glow": String(tier.glow) } : { "data-tier": tier.key };
}

/**
 * 레이팅 상수 난이도(예 6.0)와 달성률로 곡 하나의 점수를 구한다. 서버(SkillService)와 같은 식(설명서와 같은 기본 계수).
 * 난이도가 없으면(미정) null. 달성률이 0~100을 벗어나면 null.
 */
export function previewScore(tier: number | null, rate: number): number | null {
  if (tier === null || !Number.isFinite(tier) || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    return null;
  }
  return chartScore(Math.round(tier * 10), rate);
}

/**
 * 서열표 줄에 보일 "이 기록이 레이팅에 찍히는 점수". 레이팅 대상이 아니면(반영 스위치 꺼짐, 속성 없음·`레이팅 제외`, 난이도 미정) null.
 * 서버 목록과 같은 식이라 레이팅 화면의 곡 점수와 같은 값이다(저장하지 않고 화면에서 계산).
 */
export function ratedScore(
  tier: number | null,
  rate: number | null | undefined,
  entry: { ratingEnabled: boolean; pattern: string | null },
): number | null {
  if (rate === null || rate === undefined || !entry.ratingEnabled || entry.pattern === null || entry.pattern === "레이팅 제외") {
    return null;
  }
  return previewScore(tier, rate);
}
