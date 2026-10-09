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

/** 최고 티어를 넘는 점수의 빛 단계 시작점: 1단계는 최고 티어 시작점부터, 2·3단계는 아래 값부터 */
export const GLOW_2_FROM = 300;
export const GLOW_3_FROM = 350;

export interface ChartTier {
  /** player_tiers의 tier_key. CSS `[data-tier]`가 색을 정한다 */
  key: string;
  /** 0 = 빛 단계 없음. 최고 티어(하수봉) 구간에서만 1~3 (점수가 높을수록 강하다) */
  glow: 0 | 1 | 2 | 3;
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
  return { key: current.key, glow: score >= GLOW_3_FROM ? 3 : score >= GLOW_2_FROM ? 2 : 1 };
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
