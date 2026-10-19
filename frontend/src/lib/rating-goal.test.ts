import { describe, expect, it } from "vitest";
import type { SkillEntryResponse, SkillResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
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
    // 달성률을 둘째 자리로 올림하므로 실제 증가분은 필요한 10보다 조금 크다 (10.0267)
    expect(step?.gain).toBeGreaterThanOrEqual(10);
    expect(step?.gain).toBeLessThan(10.05);
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
    expect(plan?.steps[1].gain).toBeGreaterThanOrEqual(40 - 0.001); // 둘째 자리 올림 때문에 조금 크다(40.027)
    expect(plan?.steps[1].gain).toBeLessThan(40.05);
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

// ---- 목록 밖의 곡 (서열표 pool) -----------------------------------------------------------------------
// 단일 목록 한도를 2로 줄여 밀려남을 확인한다. 직접 계산한 값:
//   6.0(R=15): 90% 282.667, 95% 304   |   7.0(R=20): 70% = 20×0.7×20 = 280, 80% = 20×0.8×20 = 320
function tableEntry(id: number, pattern: string | null, rate: number | null, over: Partial<TableEntryResponse> = {}): TableEntryResponse {
  return {
    entryId: id, songDifficultyId: id, songId: id, title: `T${id}`, part: "GUITAR", difficulty: "MASTER", level: 9, pattern, ratingEnabled: true,
    mine: rate === null ? null : { rate, fullCombo: false, stage: "S" }, ...over,
  } as TableEntryResponse;
}
function group(tier: number, entries: TableEntryResponse[]): TierGroupResponse {
  return { tier, entries } as unknown as TierGroupResponse;
}
function smallSkill(single: SkillEntryResponse[], other: SkillEntryResponse[], total: number): SkillResponse {
  return { totalScore: total, single, other, singleLimit: 2, otherLimit: 25 } as unknown as SkillResponse;
}
const S1 = entry(101, "S1", 6.0, 90, 282.6667);
const S2 = entry(102, "S2", 6.0, 95, 304);

describe("goalPlan 목록 밖의 곡", () => {
  it("목록 밖 채보를 올려 들어오면 맨 아래 곡이 밀려나고 늘어나는 점수는 밀려난 곡을 뺀 값이다 (+30: 7.0 70% → 78.17%)", () => {
    // 목록(단일 2): S1 282.667, S2 304 → 합계 586.667. 목록 밖 7.0 채보(70% = 280)는 맨 아래(282.667)보다 낮아 밖에 있다.
    // 근처 폴더(6.0)만으로는 S1 → 95%의 +21.33뿐이라 모자라 전체로 넓힌다.
    // S1을 95%로 올리면 맨 아래가 304가 되고, 7.0 채보는 304 + 8.667 = 312.667이 되면 닿는다:
    //   V = 15.6333 → 15.6333/20 = 78.1667% → 올림 78.17% (점수 312.68).
    // 이때 7.0 채보가 들어오며 맨 아래 곡(S1)이 밀려나므로 S1을 올린 것은 쓸모가 없어 경로에서 빠진다. 최종 증가분 = 312.68 − 282.667 = 30.01
    const out = tableEntry(201, "단일", 70);
    const plan = goalPlan(smallSkill([S1, S2], [], 586.6667), 616.6667, [group(6.0, []), group(7.0, [out])]);
    expect(plan?.reachable).toBe(true);
    expect(plan?.widened).toBe(true);
    expect(plan?.steps).toHaveLength(1);
    expect(plan?.steps[0]).toMatchObject({ fromRate: 70, toRate: 78.17, entering: true });
    expect(plan?.steps[0].entry.title).toBe("T201");
    expect(plan?.steps[0].gain).toBeCloseTo(30.0133, 2);
    expect(plan?.displaced).toHaveLength(1);
    expect(plan?.displaced[0]).toMatchObject({ rate: 90 });
    expect(plan?.displaced[0].entry.title).toBe("S1");
    expect(plan?.displaced[0].score).toBeCloseTo(282.6667, 3);
  });

  it("목록이 아직 차지 않았으면 기록 없는 채보도 들어올 수 있고 기록 없음에서 시작하며 최소 80%부터다 (한도 2에 1곡뿐)", () => {
    // S 70% = 210. 목록에 자리가 있어서(1/2) 목록 밖 채보는 점수가 0보다 크기만 하면 들어온다.
    // +100: 근처(6.0) 안에서 S가 80%(+30)로 먼저 올라가고, 남은 70은 기록 없는 T301이 채운다.
    // 70만 채우려면 23.34%면 되지만 한 번도 안 친 곡에 어색한 목표가 되지 않게 80%부터로 둔다: 15×0.8×20 = 240
    const low = entry(110, "S", 6.0, 70, 210);
    const none = tableEntry(301, "단일", null);
    const plan = goalPlan(smallSkill([low], [], 210), 310, [group(6.0, [none])]);
    expect(plan?.reachable).toBe(true);
    expect(plan?.steps.map((s) => s.entry.title)).toEqual(["S", "T301"]);
    expect(plan?.steps[0]).toMatchObject({ fromRate: 70, toRate: 80, entering: false });
    expect(plan?.steps[1]).toMatchObject({ fromRate: null, toRate: 80, entering: true });
    expect(plan?.steps[1].gain).toBeCloseTo(240, 3);
    expect(plan?.displaced).toEqual([]);
  });

  it("레이팅 반영이 꺼진 채보와 속성이 없거나 레이팅 제외인 채보는 후보에 넣지 않는다", () => {
    const eligible = tableEntry(201, "단일", 70);
    const off = tableEntry(202, "단일", 94, { ratingEnabled: false });
    const none = tableEntry(203, null, 94);
    const excluded = tableEntry(204, "레이팅 제외", 94);
    const withJunk = goalPlan(smallSkill([S1, S2], [], 586.6667), 616.6667, [group(7.0, [eligible, off, none, excluded])]);
    const clean = goalPlan(smallSkill([S1, S2], [], 586.6667), 616.6667, [group(7.0, [eligible])]);
    expect(withJunk?.steps.map((s) => s.entry.title)).toEqual(clean?.steps.map((s) => s.entry.title));
    expect(withJunk?.steps.map((s) => s.entry.title)).not.toContain("T202");
    expect(withJunk?.steps.map((s) => s.entry.title)).not.toContain("T203");
    expect(withJunk?.steps.map((s) => s.entry.title)).not.toContain("T204");
  });

  it("복합·이중·삼중 채보는 그 외 목록에 들어가므로 단일 목록의 곡을 밀어내지 않는다", () => {
    // 단일 목록은 꽉 차 있고(2/2), 그 외 목록은 비어 있다. 6.0 복합 채보(70% = 210)는 그 외 목록에 그냥 들어오고 단일 곡은 밀려나지 않는다.
    const other = tableEntry(401, "복합", 70);
    const plan = goalPlan(smallSkill([S1, S2], [], 586.6667), 600, [group(6.0, [other])]);
    expect(plan?.displaced).toEqual([]);
    expect(plan?.steps.some((s) => s.entry.title === "T401" && s.entering)).toBe(true);
  });

  it("pool을 주지 않으면 내 레이팅 목록 안의 곡만으로 계산한다", () => {
    const plan = goalPlan(smallSkill([S1, S2], [], 586.6667), 600);
    expect(plan?.steps.map((s) => s.entry.title)).toEqual(["S1"]);
    expect(plan?.displaced).toEqual([]);
  });
});
