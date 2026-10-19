import { describe, expect, it } from "vitest";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { goalPlan } from "@/lib/rating-goal";

// 직접 계산한 값 (설명서 식: V = R×min(A,80)/100 + 3.2×min(max(A−80,0),15)/15, 점수 = V×20)
// 난이도 6.0은 R = 10×6.0−45 = 15, 7.0은 R = 5×7.0−15 = 20, 8.0은 R = 25.
//   R=15 점수: 70% 210 · 80% 240 · 85% 261.333 · 90% 282.667 · 95% 304
//   R=20 점수: 80% 320 · 85% 341.333 · 90% 362.667 · 95% 384
//   E1 6.0 70%  = 210
//   E2 6.0 82%  = (12 + 3.2×2/15)×20 = 248.533   → 85%까지 +12.8
//   E3 6.0 91%  = (12 + 3.2×11/15)×20 = 286.933  → 95%까지 +17.067
//   E4 6.0 95%  = 304 (올릴 여지 없음)
//   폴더 6.0의 평균 달성률 = (70+82+91+95)/4 = 84.5 → 현실적인 구간은 85%까지, 90·95%는 도전
function entry(id: number, title: string, tier: number, rate: number, score: number): SkillEntryResponse {
  return { rank: id, songDifficultyId: id, songId: id, title, tier, achievementRate: rate, score } as SkillEntryResponse;
}
const E1 = entry(1, "E1", 6.0, 70, 210);
const E2 = entry(2, "E2", 6.0, 82, 248.5333);
const E3 = entry(3, "E3", 6.0, 91, 286.9333);
const E4 = entry(4, "E4", 6.0, 95, 304);

function skillOf(single: SkillEntryResponse[], other: SkillEntryResponse[], total: number): SkillResponse {
  return { totalScore: total, single, other, singleLimit: 15, otherLimit: 25 } as unknown as SkillResponse;
}
const base = skillOf([E1, E2], [E3, E4], 1000);

describe("goalPlan (목표 레이팅, 80/85/90/95 구간)", () => {
  it("이미 목표 이상이거나 같거나 숫자가 아니면 null이다", () => {
    expect(goalPlan(base, 1000)).toBeNull();
    expect(goalPlan(base, 900)).toBeNull();
    expect(goalPlan(base, Number.NaN)).toBeNull();
  });

  it("올릴 폭이 가장 작은 곡부터 하나만 올린다 (+10: E2 82%→85%는 +12.8이라 한 곡이면 끝, 필요한 만큼만 84.35%)", () => {
    const plan = goalPlan(base, 1010);
    expect(plan?.reachable).toBe(true);
    expect(plan?.steps).toHaveLength(1);
    const step = plan?.steps[0];
    expect(step?.entry.title).toBe("E2");
    expect(step?.fromRate).toBe(82);
    // 248.533 + 10 = 258.533 → V = 12.9267, 가산 0.9267 → 80 + 0.9267/3.2×15 = 84.34375 → 둘째 자리 올림 84.35
    expect(step?.toRate).toBe(84.35);
    expect(step?.gain).toBeCloseTo(10, 6);
    expect(step?.challenge).toBe(false);
  });

  it("곡과 구간이 섞인다 (+30: E2 → 85%(+12.8), E1 → 70%에서 필요한 만큼 75.74%)", () => {
    const plan = goalPlan(base, 1030);
    expect(plan?.steps.map((s) => s.entry.title)).toEqual(["E2", "E1"]);
    expect(plan?.steps[0]).toMatchObject({ fromRate: 82, toRate: 85 });
    // 남은 17.2: E1 210 + 17.2 = 227.2 → V = 11.36 → 11.36/15 = 75.7333% → 올림 75.74
    expect(plan?.steps[1]).toMatchObject({ fromRate: 70, toRate: 75.74 });
    expect(plan?.steps.every((s) => !s.challenge)).toBe(true);
  });

  it("같은 곡의 여러 구간은 한 줄로 합친다 (+52.8 = E2 12.8 + E1 80%까지 30 + E1 85%쪽 10 → E1 70%→82.35%, 합계 +40)", () => {
    const plan = goalPlan(base, 1052.8);
    expect(plan?.steps.map((s) => s.entry.title)).toEqual(["E2", "E1"]);
    // E1: 210 → 240(80%) +30, 남은 10을 85% 단계에서 채움: 240 + 10 = 250 → V = 12.5 → 80 + 0.5/3.2×15 = 82.34375 → 82.35
    expect(plan?.steps[1].toRate).toBe(82.35);
    expect(plan?.steps[1].gain).toBeCloseTo(40, 3); // 입력 점수를 소수 넷째 자리까지만 적어서 오차가 조금 있다
    expect(plan?.shortfall).toBe(0);
  });

  it("폴더 평균(84.5%) 위 구간은 도전으로 표시하고 뒤에 둔다 (+70: 현실적인 합 64.13, 남은 5.87은 E3 → 95% 쪽 92.38%)", () => {
    const plan = goalPlan(base, 1070);
    expect(plan?.steps.map((s) => s.entry.title)).toEqual(["E2", "E1", "E3"]);
    expect(plan?.steps.map((s) => s.challenge)).toEqual([false, false, true]);
    expect(plan?.steps[0].toRate).toBe(85);
    expect(plan?.steps[1].toRate).toBe(85);
    // E3: 286.933 + 5.867 = 292.8 → V = 14.64, 가산 2.64 → 80 + 2.64/3.2×15 = 92.375 → 92.38
    expect(plan?.steps[2]).toMatchObject({ fromRate: 91, toRate: 92.38 });
  });

  it("이미 95% 이상인 곡은 경로에 넣지 않는다", () => {
    const plan = goalPlan(skillOf([E4, E2], [], 1000), 1005);
    expect(plan?.steps.map((s) => s.entry.title)).toEqual(["E2"]);
  });

  it("근처 폴더를 알려 준다: 평균 난이도에 가장 가까운 폴더와 앞뒤 0.1, 곡 수와 평균 달성률", () => {
    const a = entry(11, "A", 6.0, 80, 240);
    const b = entry(12, "B", 6.1, 90, 0);
    const c = entry(13, "C", 6.1, 70, 0);
    const d = entry(14, "D", 7.5, 80, 0);
    // 평균 난이도 = (6.0 + 6.1 + 6.1 + 7.5)/4 = 6.425 → 가장 가까운 폴더는 6.1 → 근처 6.0·6.1 (6.2는 곡 없음)
    const plan = goalPlan(skillOf([a, b], [c, d], 1000), 1001);
    expect(plan?.folders).toEqual([
      { tier: 6, count: 1, averageRate: 80 },
      { tier: 6.1, count: 2, averageRate: 80 },
    ]);
    expect(plan?.widened).toBe(false);
  });

  it("근처 폴더 밖의 곡은 근처 폴더만으로 닿을 때 쓰지 않는다", () => {
    // 6.0 곡 4개(70%)와 8.0 곡 1개(70%): 평균 난이도 6.4 → 근처는 6.0. 8.0 곡은 이번 경로에 안 나온다
    const near = [1, 2, 3, 4].map((i) => entry(20 + i, `N${i}`, 6.0, 70, 210));
    const far = entry(30, "FAR", 8.0, 70, 350);
    const plan = goalPlan(skillOf(near, [far], 1000), 1020);
    expect(plan?.widened).toBe(false);
    expect(plan?.steps.map((s) => s.entry.title)).not.toContain("FAR");
  });

  it("근처 폴더만으로 모자라면 목록 전체로 넓힌다 (widened)", () => {
    // 6.0 곡 1개(70%, 올릴 수 있는 최대 +94)와 8.0 곡 1개(95%, 여지 없음)가 아니라, 8.0 곡도 70%(R=25: 350 → 95%는 +... )로 둔다
    // 평균 난이도 7.0은 두 폴더의 한가운데라 가까운 폴더는 6.0(먼저 나온 쪽). 근처 최대 +94, 목표 +100이면 8.0 곡도 필요하다
    const low = entry(40, "LOW", 6.0, 70, 210); // 95%까지 +94
    const high = entry(41, "HIGH", 8.0, 70, 350); // R=25: 95% = 25×0.8×20 + 3.2×20 = 400 + 64 = 464 → +114
    const plan = goalPlan(skillOf([low], [high], 1000), 1100);
    expect(plan?.widened).toBe(true);
    expect(plan?.reachable).toBe(true);
    expect(plan?.steps.map((s) => s.entry.title)).toContain("HIGH");
  });

  it("목록 안의 곡을 모두 95%로 올려도 모자라면 reachable=false이고 모자란 점수를 알려 준다", () => {
    // E1 하나만: 95%까지 +94. 목표 +200 → 모자람 106
    const plan = goalPlan(skillOf([E1], [], 1000), 1200);
    expect(plan?.reachable).toBe(false);
    expect(plan?.maxGain).toBeCloseTo(94, 6);
    expect(plan?.shortfall).toBeCloseTo(106, 6);
    expect(plan?.steps).toHaveLength(1);
    expect(plan?.steps[0]).toMatchObject({ fromRate: 70, toRate: 95 });
  });

  it("올릴 곡이 없으면(모두 95% 이상이거나 목록이 비어 있음) 경로 없이 reachable=false다", () => {
    expect(goalPlan(skillOf([E4], [], 1000), 1100)).toMatchObject({ steps: [], reachable: false, maxGain: 0 });
    expect(goalPlan(skillOf([], [], 0), 10)).toMatchObject({ steps: [], reachable: false, folders: [] });
  });

  it("경계: 목표가 정확히 모든 여지의 합이면 닿는다 (E1만: +94)", () => {
    const plan = goalPlan(skillOf([E1], [], 1000), 1094);
    expect(plan?.reachable).toBe(true);
    expect(plan?.steps[0].toRate).toBe(95);
  });
});
