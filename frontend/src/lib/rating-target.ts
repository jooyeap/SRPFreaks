import type { SkillEntryResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { DEFAULT_COEFFICIENTS, ratingConstant, type RatingCoefficients } from "@/lib/rating-guide";

/**
 * 레이팅 예상 값 (D31): "이 점수를 곡 하나에서 내려면 어떤 레이팅 상수 난이도를 몇 %로 쳐야 하나"를 거꾸로 계산한다.
 * 기준 점수는 내 레이팅 목록의 몇 위 점수로 정한다: 단일은 1·7·15위, 그 외(복합·이중·삼중)는 1·12·25위(목록의 처음·중간·끝).
 * 저장하는 값은 없고, 서버가 계산한 내 목록 점수와 서열표 묶음을 화면에서 맞춰 볼 뿐이다.
 */
export type PlanKind = "single" | "other";

export const PLAN_RANKS: Record<PlanKind, readonly number[]> = {
  single: [1, 7, 15],
  other: [1, 12, 25],
};

/** 목록 종류별로 해당하는 속성. 단일 목록에는 단일 채보만, 그 외 목록에는 복합·이중·삼중 채보만 들어간다. */
const PATTERNS: Record<PlanKind, readonly string[]> = {
  single: ["단일"],
  other: ["복합", "이중", "삼중"],
};

export interface PlanTarget {
  rank: number;
  score: number;
}

/** 목록에서 정해 둔 순위의 점수를 고른다. 목록이 그 순위까지 차지 않았으면(예: 10곡뿐인데 15위) 그 순위는 뺀다. */
export function planTargets(entries: readonly SkillEntryResponse[], kind: PlanKind): PlanTarget[] {
  const targets: PlanTarget[] = [];
  for (const rank of PLAN_RANKS[kind]) {
    const found = entries.find((e) => e.rank === rank);
    if (found) {
      targets.push({ rank, score: found.score });
    }
  }
  return targets;
}

/**
 * 레이팅 상수 난이도 T(0.1 단위 정수 tenths)에서 점수 score를 내는 데 필요한 최소 달성률(소수 둘째 자리 올림).
 * chartScore의 역함수다. V = score / 배수.
 *  - V가 R×capRate/100 이하이면 가산 구간 아래: 달성률 = V / R × 100
 *  - 그보다 크면 가산 구간: 달성률 = capRate + (V − R×capRate/100) / bonus × (maxRate − capRate)
 * 가산 구간을 다 채운 값(maxRate, 기본 95%)으로도 못 내는 점수면 null(그 난이도로는 불가능).
 * 둘째 자리 "올림"인 이유: 반올림하면 표시한 달성률로 쳤는데 점수가 조금 모자랄 수 있다.
 */
export function requiredRate(tenths: number, score: number, c: RatingCoefficients = DEFAULT_COEFFICIENTS): number | null {
  const r = ratingConstant(tenths, c);
  if (r <= 0 || !Number.isFinite(score)) {
    return null;
  }
  if (score <= 0) {
    return 0;
  }
  const v = score / c.multiplier;
  const base = (r * c.capRate) / 100;
  let rate: number;
  if (v <= base) {
    rate = (v / r) * 100;
  } else {
    const extra = v - base;
    if (extra > c.bonus + 1e-9) {
      return null;
    }
    rate = c.capRate + (extra / c.bonus) * (c.maxRate - c.capRate);
  }
  // 부동소수 오차(예: 93.1000000001)로 한 칸 위로 올림되지 않게 아주 작은 값을 빼고 올린다
  return Math.min(Math.ceil(rate * 100 - 1e-6) / 100, c.maxRate);
}

export interface PlanRow {
  /** 레이팅 상수 난이도 */
  tier: number;
  /** targets와 같은 순서. 그 난이도로는 낼 수 없는 점수면 null */
  needs: (number | null)[];
  /** 이 목록에 들어갈 수 있는 이 난이도의 채보(속성 맞고 레이팅 반영이 켜진 것) */
  entries: TableEntryResponse[];
}

function countsFor(kind: PlanKind, entry: TableEntryResponse): boolean {
  return entry.ratingEnabled && entry.pattern !== null && PATTERNS[kind].includes(entry.pattern);
}

/**
 * 난이도(서열표 묶음)마다 기준 점수별 필요 달성률과 그 난이도 채보를 모은다. 서열표 순서(높은 난이도 먼저)를 유지한다.
 * 이 목록에 들어갈 채보가 하나도 없는 난이도, 그리고 기준 점수를 하나도 못 내는 난이도는 뺀다.
 */
export function planRows(
  groups: readonly TierGroupResponse[],
  kind: PlanKind,
  targets: readonly PlanTarget[],
  c: RatingCoefficients = DEFAULT_COEFFICIENTS,
): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const group of groups) {
    if (group.tier === null) {
      continue;
    }
    const entries = group.entries.filter((e) => countsFor(kind, e));
    if (entries.length === 0) {
      continue;
    }
    const tenths = Math.round(group.tier * 10);
    const needs = targets.map((t) => requiredRate(tenths, t.score, c));
    if (needs.every((n) => n === null)) {
      continue;
    }
    rows.push({ tier: group.tier, needs, entries });
  }
  return rows;
}
