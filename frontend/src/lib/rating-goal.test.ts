import { describe, expect, it } from "vitest";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { goalPlan } from "@/lib/rating-goal";

// 직접 계산한 값 (설명서 식: V = R×min(A,80)/100 + 3.2×min(max(A−80,0),15)/15, 점수 = V×20)
//  A: 6.0(R=15) 80%  = 15×0.8×20 = 240      → 95%는 304,     올릴 여지 64
//  B: 7.0(R=20) 90%  = (16 + 2.1333)×20 = 362.667 → 95%는 384, 올릴 여지 21.333
//  C: 6.0(R=15) 90%  = (12 + 2.1333)×20 = 282.667 → 95%는 304, 올릴 여지 21.333
//  D: 6.0 95%        = 304 (이미 95%, 올릴 여지 없음)
function entry(id: number, title: string, tier: number, rate: number, score: number): SkillEntryResponse {
  return { rank: id, songDifficultyId: id, songId: id, title, tier, achievementRate: rate, score } as SkillEntryResponse;
}
const A = entry(1, "A", 6.0, 80, 240);
const B = entry(2, "B", 7.0, 90, 362.6667);
const C = entry(3, "C", 6.0, 90, 282.6667);
const D = entry(4, "D", 6.0, 95, 304);

function skillOf(single: SkillEntryResponse[], other: SkillEntryResponse[], total: number): SkillResponse {
  return { totalScore: total, single, other, singleLimit: 15, otherLimit: 25 } as unknown as SkillResponse;
}

describe("goalPlan (목표 레이팅)", () => {
  it("이미 목표 이상이거나 같으면 null이다", () => {
    expect(goalPlan(skillOf([A], [], 1000), 1000)).toBeNull();
    expect(goalPlan(skillOf([A], [], 1000), 900)).toBeNull();
    expect(goalPlan(skillOf([A], [], 1000), Number.NaN)).toBeNull();
  });

  it("한 곡으로 채울 수 있으면 여지가 가장 작은 곡 하나만 필요한 만큼 올린다 (+40: A는 64, B·C는 21.33이라 A)", () => {
    const plan = goalPlan(skillOf([B], [A, C], 1000), 1040);
    expect(plan?.reachable).toBe(true);
    expect(plan?.needed).toBeCloseTo(40, 6);
    expect(plan?.steps).toHaveLength(1);
    const step = plan?.steps[0];
    expect(step?.entry.title).toBe("A");
    expect(step?.fromRate).toBe(80);
    // 240 + 40 = 280 → V = 14, 가산 구간 2 → 80 + 2/3.2×15 = 89.375 → 둘째 자리 올림 89.38
    expect(step?.toRate).toBe(89.38);
    expect(step?.gain).toBeCloseTo(40, 6);
  });

  it("한 곡으로 모자라면 큰 곡을 95%까지 올리고 남은 점수는 여지가 맞는 곡으로 채운다 (+100 = 64 + 21.33 + 14.67)", () => {
    const plan = goalPlan(skillOf([B], [A, C], 1000), 1100);
    expect(plan?.reachable).toBe(true);
    expect(plan?.steps.map((s) => s.entry.title)).toEqual(["A", "B", "C"]);
    expect(plan?.steps[0]).toMatchObject({ toRate: 95 });
    expect(plan?.steps[1]).toMatchObject({ toRate: 95 });
    // 마지막: C를 282.667 + 14.667 = 297.333 → V = 14.8667, 가산 2.8667 → 80 + 13.4375 = 93.4375 → 93.44
    expect(plan?.steps[2].toRate).toBe(93.44);
    expect(plan?.shortfall).toBe(0);
  });

  it("이미 95% 이상인 곡은 경로에 넣지 않는다", () => {
    const plan = goalPlan(skillOf([D, A], [], 1000), 1010);
    expect(plan?.steps.map((s) => s.entry.title)).toEqual(["A"]);
  });

  it("목록 안의 곡을 모두 95%로 올려도 모자라면 reachable=false이고 모자란 점수를 알려 준다 (+200 중 64 + 21.33×2 = 106.67)", () => {
    const plan = goalPlan(skillOf([B], [A, C], 1000), 1200);
    expect(plan?.reachable).toBe(false);
    expect(plan?.maxGain).toBeCloseTo(106.6667, 3);
    expect(plan?.shortfall).toBeCloseTo(93.3333, 3);
    expect(plan?.steps).toHaveLength(3); // 올릴 수 있는 곡을 전부 95%까지
    expect(plan?.steps.every((s) => s.toRate === 95)).toBe(true);
  });

  it("올릴 곡이 없으면(모두 95% 이상이거나 목록이 비어 있음) 경로 없이 reachable=false다", () => {
    expect(goalPlan(skillOf([D], [], 1000), 1100)).toMatchObject({ steps: [], reachable: false, maxGain: 0 });
    expect(goalPlan(skillOf([], [], 0), 10)).toMatchObject({ steps: [], reachable: false });
  });

  it("경계: 목표가 정확히 모든 여지의 합이면 닿는다", () => {
    const plan = goalPlan(skillOf([], [A], 1000), 1064);
    expect(plan?.reachable).toBe(true);
    expect(plan?.steps[0].toRate).toBe(95);
  });
});
