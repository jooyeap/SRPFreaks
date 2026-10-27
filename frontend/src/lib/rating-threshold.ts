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
  const tenths = Math.round(tier * 10);
  const needs: number[] = [];
  for (const [entries, limit] of [
    [skill.single, skill.singleLimit],
    [skill.other, skill.otherLimit],
  ] as const) {
    const score = cutoffScore(entries, limit);
    if (score === null) {
      continue;
    }
    const need = requiredRate(tenths, score);
    if (need !== null) {
      needs.push(need);
    }
  }
  if (needs.length === 0) {
    return null;
  }
  const easiest = Math.min(...needs);
  return THRESHOLD_STEPS.find((step) => step >= easiest) ?? null;
}
