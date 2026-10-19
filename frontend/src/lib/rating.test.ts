import { describe, expect, it } from "vitest";
import type { PlayerTierResponse, SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { atRiskEntries, goalHint, quickestRise, skillKeys, tierProgress } from "@/lib/rating";

const orange: PlayerTierResponse = {
  key: "ORANGE",
  displayName: "Orange",
  minScore: 1000,
  nextDisplayName: "Orange Gradient",
  nextMinScore: 1500,
};
const top: PlayerTierResponse = {
  key: "HSB",
  displayName: "HSB",
  minScore: 11000,
  nextDisplayName: null,
  nextMinScore: null,
};

describe("tierProgress", () => {
  it("구간 안의 위치와 다음 티어까지 남은 점수를 계산한다", () => {
    const p = tierProgress(1125, orange);
    expect(p?.ratio).toBeCloseTo(0.25);
    expect(p?.remaining).toBe(375);
    expect(p?.nextDisplayName).toBe("Orange Gradient");
  });

  it("구간 시작점이면 0, 다음 티어 직전이면 1에 가깝다", () => {
    expect(tierProgress(1000, orange)?.ratio).toBe(0);
    expect(tierProgress(1499.99, orange)?.ratio).toBeCloseTo(0.99998, 4);
  });

  it("마지막 티어는 null (화면에는 '최고 티어')", () => {
    expect(tierProgress(9800, top)).toBeNull();
  });

  it("반올림 때문에 합계가 구간 밖으로 보여도 막대와 남은 점수를 범위 안으로 맞춘다", () => {
    expect(tierProgress(999.99, orange)?.ratio).toBe(0);
    expect(tierProgress(1500.0, orange)).toMatchObject({ ratio: 1, remaining: 0 });
    expect(tierProgress(1500.01, orange)).toMatchObject({ ratio: 1, remaining: 0 });
  });

  it("합계가 0이어도 오류 없이 계산한다", () => {
    const white: PlayerTierResponse = { key: "WHITE", displayName: "White", minScore: 0, nextDisplayName: "White Gradient", nextMinScore: 500 };
    expect(tierProgress(0, white)).toMatchObject({ ratio: 0, remaining: 500 });
  });
});

describe("skillKeys", () => {
  it("사용자 id를 키에 넣고, 기록 변경 때 무효화되는 'skill' 키로 시작한다", () => {
    expect(skillKeys.me(3)).toEqual(["skill", 3]);
    expect(skillKeys.me(3)).not.toEqual(skillKeys.me(4));
  });
});

function skillEntry(rank: number, score: number): SkillEntryResponse {
  return { rank, songDifficultyId: rank, songId: rank, title: `곡${rank}`, score } as SkillEntryResponse;
}
function scores(...values: number[]): SkillEntryResponse[] {
  return values.map((v, i) => skillEntry(i + 1, v));
}

describe("atRiskEntries (곧 빠질 곡)", () => {
  it("구역이 덜 찼거나 비었으면 밀려날 곡이 없다", () => {
    expect(atRiskEntries(scores(50, 40), 3)).toEqual([]);
    expect(atRiskEntries([], 0)).toEqual([]);
  });

  it("꽉 찼으면 맨 아래 곡과 점수 차이가 2점 이하인 곡만, 최대 3곡 고른다", () => {
    const result = atRiskEntries(scores(80, 60, 31.5, 31, 30.5, 30), 6);
    expect(result.map((e) => e.score)).toEqual([31, 30.5, 30]); // 31.5는 차이 1.5라 해당되지만 최대 3곡이라 아래 3곡만
  });

  it("맨 아래 곡이 혼자 멀리 떨어져 있으면 그 곡 하나만이다", () => {
    expect(atRiskEntries(scores(80, 60, 40), 3).map((e) => e.score)).toEqual([40]);
  });
});

describe("goalHint (레이팅 목표 안내)", () => {
  function skillOf(over: Partial<SkillResponse>): SkillResponse {
    return {
      noteOption: "SUPER_RANDOM_PLUS", totalScore: 1400, singleScore: 700, otherScore: 700, tier: orange,
      singleLimit: 2, otherLimit: 2, single: scores(400, 300), other: scores(500, 200), ...over,
    };
  }

  it("꽉 찬 구역은 밀려나는 점수 + 남은 점수가 필요하고, 더 작은 쪽 구역을 고른다", () => {
    // 남은 점수 100. 단일은 맨 아래 300 -> 400 필요, 그 외는 맨 아래 200 -> 300 필요
    expect(goalHint(skillOf({}))).toEqual({
      nextDisplayName: "Orange Gradient", remaining: 100, needScore: 300, groupName: "복합·이중·삼중", replacedScore: 200,
    });
  });

  it("덜 찬 구역은 곡이 그냥 추가되므로 남은 점수만 필요하다", () => {
    const hint = goalHint(skillOf({ single: scores(400), singleLimit: 2 }));
    expect(hint).toMatchObject({ groupName: "단일", needScore: 100, replacedScore: null });
  });

  it("최고 티어이면 목표가 없다", () => {
    expect(goalHint(skillOf({ tier: top }))).toBeNull();
  });
});

describe("quickestRise (티어 승급 예고)", () => {
  // 직접 계산: 6.0(R=15) 80% = 15×0.8×20 = 240 → 95%는 304, 늘어나는 점수 64.
  //           7.0(R=20) 90% = (16 + 3.2×10/15)×20 = 362.67 → 95%는 384, 늘어나는 점수 21.33.
  const entryOf = (over: Partial<SkillEntryResponse>): SkillEntryResponse =>
    ({ rank: 1, songDifficultyId: 1, songId: 1, title: "곡", tier: 6.0, achievementRate: 80, score: 240, ...over }) as SkillEntryResponse;
  const skillOf = (single: SkillEntryResponse[], other: SkillEntryResponse[], total: number, tier = orange): SkillResponse =>
    ({ totalScore: total, tier, single, other, singleLimit: 15, otherLimit: 25 }) as unknown as SkillResponse;

  it("95%까지 올렸을 때 점수가 가장 많이 늘어나는 곡 하나를 고른다 (6.0/80% +64 > 7.0/90% +21.33)", () => {
    const a = entryOf({ songId: 1, title: "A", tier: 6.0, achievementRate: 80, score: 240 });
    const b = entryOf({ songId: 2, songDifficultyId: 2, title: "B", tier: 7.0, achievementRate: 90, score: 362.67 });
    const rise = quickestRise(skillOf([b], [a], 1100));
    expect(rise?.entry.title).toBe("A");
    expect(rise?.gain).toBeCloseTo(64, 5);
    expect(rise?.newTotal).toBeCloseTo(1164, 5);
    expect(rise?.reachesNext).toBe(false); // 다음 티어(1500)까지는 아직 멀다
  });

  it("그 곡만 올려도 다음 티어에 닿으면 reachesNext가 true다 (합계 1450 + 64 = 1514 ≥ 1500)", () => {
    const a = entryOf({});
    expect(quickestRise(skillOf([a], [], 1450))?.reachesNext).toBe(true);
    // 경계: 합계 + 증가량이 정확히 1500이면 도달 (1436 + 64)
    expect(quickestRise(skillOf([a], [], 1436))?.reachesNext).toBe(true);
    expect(quickestRise(skillOf([a], [], 1435.99))?.reachesNext).toBe(false);
  });

  it("이미 95% 이상인 곡은 올릴 여지가 없어 건너뛴다", () => {
    const done = entryOf({ achievementRate: 95, score: 304 });
    const max = entryOf({ achievementRate: 100, score: 304, songId: 2, songDifficultyId: 2 });
    expect(quickestRise(skillOf([done], [max], 1100))).toBeNull();
  });

  it("목록이 비었으면 null이다", () => {
    expect(quickestRise(skillOf([], [], 0))).toBeNull();
  });

  it("최고 티어(더 올라갈 티어 없음)이면 null이다", () => {
    expect(quickestRise(skillOf([entryOf({})], [], 12000, top))).toBeNull();
  });

  it("증가량이 같으면 목록 앞쪽(단일 먼저)을 고른다", () => {
    const s = entryOf({ songId: 1, title: "단일곡" });
    const o = entryOf({ songId: 2, songDifficultyId: 2, title: "복합곡" });
    expect(quickestRise(skillOf([s], [o], 1100))?.entry.title).toBe("단일곡");
  });
});
