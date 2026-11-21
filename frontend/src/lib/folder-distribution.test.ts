import { describe, expect, it } from "vitest";
import type { DistFolder, DistUser } from "@/lib/chart-stats";
import { PLAYER_TIER_MINS } from "@/lib/chart-tier";
import {
  averageSegments,
  bucketLabel,
  bucketStart,
  buildBuckets,
  inTierGroup,
  jitterFraction,
  tierGroupLabel,
  tierGroupRange,
  yPercent,
  yRange,
} from "@/lib/folder-distribution";

function user(userId: number, key: string | null): DistUser {
  return { userId, nickname: `n${userId}`, tier: key ? { key, displayName: key, minScore: 0, nextDisplayName: null, nextMinScore: null } : null, totalScore: 0 };
}

function folder(tier: number, ...cells: [number, number, number][]): DistFolder {
  return { tier, cells: cells.map(([userId, charts, sumRate]) => ({ userId, charts, sumRate })) };
}

describe("폴더 묶음", () => {
  it("0.1 단위는 그대로, 0.5 단위는 0.5의 배수로 내린다(부동소수 오차 없이)", () => {
    expect(bucketStart(8.1, "0.1")).toBe(8.1);
    expect(bucketStart(8.4, "0.5")).toBe(8);
    expect(bucketStart(8.5, "0.5")).toBe(8.5);
    expect(bucketStart(8.9, "0.5")).toBe(8.5);
    expect(bucketStart(6.6, "0.5")).toBe(6.5);
    expect(bucketLabel(8, "0.5")).toBe("8.0~8.4");
    expect(bucketLabel(8.1, "0.1")).toBe("8.1");
  });

  it("유저가 3명 미만인 폴더는 점이 없고 표본 부족이다(유저 수는 센다)", () => {
    const buckets = buildBuckets([folder(6.0, [1, 1, 80], [2, 1, 90]), folder(6.1, [1, 1, 80], [2, 1, 90], [3, 1, 70])], [user(1, "RED"), user(2, "GOLD"), user(3, "BRONZE")], "0.1", 3);

    expect(buckets[0]).toMatchObject({ start: 6, sufficient: false, users: 2, points: [], avg: null });
    expect(buckets[1].sufficient).toBe(true);
    expect(buckets[1].points).toHaveLength(3);
  });

  it("점 = 유저의 폴더 평균(합 ÷ 채보 수), 폴더 평균선 = 점들의 평균", () => {
    const [bucket] = buildBuckets([folder(6.0, [1, 2, 170], [2, 1, 90], [3, 4, 300])], [user(1, null), user(2, null), user(3, null)], "0.1", 3);

    expect(bucket.points.map((p) => p.avg)).toEqual([85, 90, 75]);
    expect(bucket.avg).toBeCloseTo(83.3333, 3);
    expect(bucket.points.map((p) => p.charts)).toEqual([2, 1, 4]);
  });

  it("0.5 단위로 묶으면 한 유저의 칸이 합쳐지고 평균은 채보 수 가중이다", () => {
    const buckets = buildBuckets(
      [folder(8.0, [1, 1, 100], [2, 1, 50]), folder(8.3, [1, 3, 240], [2, 1, 50]), folder(8.4, [3, 1, 70]), folder(8.5, [1, 1, 10])],
      [user(1, null), user(2, null), user(3, null)],
      "0.5",
      3,
    );

    expect(buckets.map((b) => b.label)).toEqual(["8.0~8.4", "8.5~8.9"]);
    const first = buckets[0].points.find((p) => p.userId === 1);
    expect(first).toMatchObject({ charts: 4, avg: 85 });          // (100 + 240) ÷ 4
    expect(buckets[1]).toMatchObject({ sufficient: false, users: 1 });
  });

  it("티어 key와 이름은 티어 표(PLAYER_TIER_MINS)에서 읽고 티어를 모르면 null이다", () => {
    const [bucket] = buildBuckets([folder(6.0, [1, 1, 80], [2, 1, 80], [3, 1, 80])], [user(1, "GOLD"), user(2, null)], "0.1", 3);

    const gold = bucket.points.find((p) => p.userId === 1);
    expect(gold?.tierKey).toBe("GOLD");
    expect(gold?.tierName).toBe(PLAYER_TIER_MINS.find((t) => t.key === "GOLD")?.name);
    expect(bucket.points.find((p) => p.userId === 2)?.tierKey).toBeNull();
    expect(bucket.points.find((p) => p.userId === 3)?.tierKey).toBeNull();   // 유저 정보가 없어도 깨지지 않는다
  });
});

describe("티어 강조 칩", () => {
  const keys = PLAYER_TIER_MINS.map((t) => t.key);

  it("경계는 티어 표의 순서에서 읽는다: 처음~Red Gradient / Bronze~Iridescent / Iridescent 다음~끝", () => {
    expect(tierGroupRange("low")).toEqual({ from: 0, to: keys.indexOf("RED_GRADIENT") });
    expect(tierGroupRange("mid")).toEqual({ from: keys.indexOf("BRONZE"), to: keys.indexOf("IRIDESCENT") });
    expect(tierGroupRange("high")).toEqual({ from: keys.indexOf("IRIDESCENT") + 1, to: keys.length - 1 });
  });

  it("칩 이름은 티어 표의 이름으로 만든다(새 티어가 생겨도 표만 바뀐다)", () => {
    expect(tierGroupLabel("low")).toBe("~Red Gradient");
    expect(tierGroupLabel("mid")).toBe("Bronze~Iridescent");
    expect(tierGroupLabel("high")).toBe(`${PLAYER_TIER_MINS[keys.indexOf("IRIDESCENT") + 1].name}~`);
    expect(tierGroupLabel("all")).toBeNull();
  });

  it("점이 어느 티어군에 드는지 판정한다(세 티어군은 겹치지 않고 모든 티어를 덮는다)", () => {
    for (const key of keys) {
      const hits = (["low", "mid", "high"] as const).filter((group) => inTierGroup(key, group));
      // Bronze 아래 사이(Red Gradient 다음)에는 빈 티어가 없다: 모든 티어가 정확히 한 군에 든다
      expect(hits, key).toHaveLength(1);
      expect(inTierGroup(key, "all")).toBe(true);
    }
    expect(inTierGroup("RED", "low")).toBe(true);
    expect(inTierGroup("BRONZE", "low")).toBe(false);
    expect(inTierGroup("IRIDESCENT", "mid")).toBe(true);
    expect(inTierGroup(PLAYER_TIER_MINS[PLAYER_TIER_MINS.length - 1].key, "high")).toBe(true);
    expect(inTierGroup(null, "high")).toBe(false);
    expect(inTierGroup(null, "all")).toBe(true);
    expect(inTierGroup("UNKNOWN_KEY", "mid")).toBe(false);
  });
});

describe("그래프 좌표", () => {
  const bucket = (start: number, avgs: number[]) => ({
    start,
    label: String(start),
    sufficient: avgs.length > 0,
    users: avgs.length,
    avg: avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null,
    points: avgs.map((avg, i) => ({ userId: i + 1, nickname: "", tierKey: null, tierName: null, avg, charts: 1 })),
  });

  it("y축은 위가 100이고 S 기준선(80)이 늘 보이도록 아래는 70 이하다", () => {
    expect(yRange([])).toEqual({ min: 60, max: 100 });
    expect(yRange([bucket(6, [95, 98, 99])])).toEqual({ min: 70, max: 100 });
    expect(yRange([bucket(6, [52, 80, 90])])).toEqual({ min: 50, max: 100 });
  });

  it("값이 클수록 위(작은 %)이고 범위 밖은 끝에 붙는다", () => {
    const range = { min: 60, max: 100 };
    expect(yPercent(100, range)).toBe(0);
    expect(yPercent(80, range)).toBe(50);
    expect(yPercent(60, range)).toBe(100);
    expect(yPercent(40, range)).toBe(100);
  });

  it("점의 가로 자리는 유저마다 정해져 있고 칸 안(20~81%)에 든다", () => {
    for (const id of [1, 2, 37, 1000, 123456]) {
      const f = jitterFraction(id);
      expect(f).toBeGreaterThanOrEqual(0.2);
      expect(f).toBeLessThanOrEqual(0.81);
      expect(jitterFraction(id)).toBe(f);
    }
  });

  it("폴더 평균선은 표본 부족 폴더에서 끊긴다", () => {
    const buckets = [bucket(6.0, [80, 90, 70]), bucket(6.1, []), bucket(6.2, [90, 90, 90]), bucket(6.3, [70, 70, 70])];

    const segments = averageSegments(buckets, { min: 60, max: 100 });

    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(1);
    expect(segments[1]).toHaveLength(2);
    expect(segments[1][0].x).toBeCloseTo(62.5);
  });
});
