import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { requiredRate } from "@/lib/rating-target";

/** 안내에 쓰는 달성률 단계. 작은 값부터 본다(95 > 90 > 85 > 80은 큰 쪽이 더 어렵다는 뜻이다). */
export const THRESHOLD_STEPS = [80, 85, 90, 95] as const;

/** 목록이 가득 찼을 때 맨 아래(단일은 15위, 그 외는 25위)의 점수. 덜 찼으면 null(= 아직 들어갈 자리가 남아 있다). */
function cutoffScore(entries: readonly SkillEntryResponse[], limit: number): number | null {
  if (limit <= 0 || entries.length < limit) {
    return null;
  }
  return entries.find((e) => e.rank === limit)?.score ?? null;
}

/** 안내 단계로 올린 값. 목록이 덜 찼거나 어떤 달성률로도 못 넘으면 null */
function stepFor(entries: readonly SkillEntryResponse[], limit: number, tenths: number): number | null {
  const score = cutoffScore(entries, limit);
  if (score === null) {
    return null;
  }
  const need = requiredRate(tenths, score);
  if (need === null) {
    return null;
  }
  return THRESHOLD_STEPS.find((step) => step >= need) ?? null;
}

/**
 * 기준 난이도 tenths(0.1 단위 정수, 6.0 → 60) 곡을 단일 목록·그 외 목록 각각에 넣으려면 몇 % 이상이어야 하는지(안내 단계 80/85/90/95).
 * 서열표 묶음 화면처럼 두 목록을 나눠 보여 줄 때 쓴다. 각 값의 규칙은 ratingEntryThreshold와 같다.
 */
export function ratingEntryThresholds(skill: SkillResponse, tenths: number): { single: number | null; other: number | null } {
  return {
    single: stepFor(skill.single, skill.singleLimit, tenths),
    other: stepFor(skill.other, skill.otherLimit, tenths),
  };
}

/**
 * 서열표 구간(`6.0` 같은 기준 난이도 하나) 곡을 몇 % 이상으로 치면 내 레이팅 목록에 새로 들어가는지, 안내용 단계(80/85/90/95)로 돌려준다.
 * - 단일 목록과 그 외 목록 둘 다 보고, **더 쉬운 쪽**(필요한 달성률이 낮은 쪽)의 값을 쓴다. 곡 하나가 어느 목록에 속하는지는 속성에 달려 있어서다.
 * - 목록이 가득 차지 않은 쪽은 맨 아래 점수가 없으니 계산하지 않는다. 둘 다 그렇거나, 어떤 달성률로도 못 넘으면 null.
 * - 필요한 달성률은 requiredRate(점수 역산, 둘째 자리 올림)를 안내 단계로 한 번 더 올린다. 그래서 안내한 %로 치면 항상 들어간다.
 * - `6.5 이상`처럼 합쳐진 줄이나 읽을 수 없는 키는 기준 난이도가 하나로 정해지지 않으므로 null.
 */
export function ratingEntryThreshold(skill: SkillResponse, groupKey: string): number | null {
  const tier = Number(groupKey);
  if (!Number.isFinite(tier)) {
    return null;
  }
  const { single, other } = ratingEntryThresholds(skill, Math.round(tier * 10));
  const steps = [single, other].filter((step): step is number => step !== null);
  // 단계로 올린 뒤 비교해도 "더 쉬운 쪽"은 같다(단계 올림은 순서를 바꾸지 않는다)
  return steps.length === 0 ? null : Math.min(...steps);
}
