import { describe, expect, it } from "vitest";
import type { DistFolder, DistUser } from "@/lib/chart-stats";
import { PLAYER_TIER_MINS } from "@/lib/chart-tier";
import {
  averageSegments,
  bucketLabel,
  bucketStart,
  buildBuckets,
  buildWindows,
  busiestGroup,
  busiestWindow,
  inTierGroup,
  kstDate,
  layoutDotX,
  tierGroupLabel,
  tierGroupRange,
  windowOf,
  yPercent,
  yRange,
  type DistPoint,
} from "@/lib/folder-distribution";

function user(userId: number, key: string | null): DistUser {
  return { userId, nickname: `n${userId}`, tier: key ? { key, displayName: key, minScore: 0, nextDisplayName: null, nextMinScore: null } : null, totalScore: 0 };
}

function folder(tier: number, ...cells: [number, number, number, string?][]): DistFolder {
  return { tier, cells: cells.map(([userId, charts, sumRate, lastRecordedAt]) => ({ userId, charts, sumRate, lastRecordedAt: lastRecordedAt ?? null })) };
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
    points: avgs.map((avg, i) => ({ userId: i + 1, nickname: "", tierKey: null, tierName: null, avg, charts: 1, lastRecordedAt: null })),
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

  it("폴더 평균선은 표본 부족 폴더에서 끊긴다", () => {
    const buckets = [bucket(6.0, [80, 90, 70]), bucket(6.1, []), bucket(6.2, [90, 90, 90]), bucket(6.3, [70, 70, 70])];

    const segments = averageSegments(buckets, { min: 60, max: 100 });

    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(1);
    expect(segments[1]).toHaveLength(2);
    expect(segments[1][0].x).toBeCloseTo(62.5);
  });
});

function dot(userId: number, avg: number, tierKey: string | null = null): DistPoint {
  return { userId, nickname: `n${userId}`, tierKey, tierName: null, avg, charts: 1, lastRecordedAt: null };
}

describe("마지막 기록 저장일", () => {
  it("UTC 시각을 Asia/Seoul 날짜로 바꾼다(UTC 15시 이후는 다음 날)", () => {
    expect(kstDate("2026-11-20T14:59:59Z")).toBe("2026-11-20");
    expect(kstDate("2026-11-20T15:00:00Z")).toBe("2026-11-21");
    expect(kstDate("2026-12-31T16:00:00.123456Z")).toBe("2027-01-01");
  });

  it("없거나 읽을 수 없으면 null이다", () => {
    expect(kstDate(null)).toBeNull();
    expect(kstDate("날짜 아님")).toBeNull();
  });

  it("0.5 단위로 묶으면 묶인 폴더 중 가장 늦은 시각을 쓰고, 한쪽이 null이면 다른 쪽을 쓴다", () => {
    const buckets = buildBuckets(
      [
        folder(8.0, [1, 1, 80, "2026-11-01T00:00:00Z"], [2, 1, 80], [3, 1, 80, "2026-11-03T00:00:00Z"]),
        folder(8.3, [1, 1, 80, "2026-11-09T00:00:00Z"], [2, 1, 80, "2026-11-02T00:00:00Z"], [3, 1, 80]),
      ],
      [user(1, null), user(2, null), user(3, null)],
      "0.5",
      3,
    );

    const byId = new Map(buckets[0].points.map((p) => [p.userId, p.lastRecordedAt]));
    expect(byId.get(1)).toBe("2026-11-09T00:00:00Z");   // 늦은 쪽
    expect(byId.get(2)).toBe("2026-11-02T00:00:00Z");   // null과 값 → 값
    expect(byId.get(3)).toBe("2026-11-03T00:00:00Z");
  });
});

describe("점 가로 배치(layoutDotX)", () => {
  const points = [dot(1, 90), dot(2, 90), dot(3, 90.2), dot(4, 90.1), dot(5, 70), dot(37, 90), dot(1000, 89.9)];

  it("같은 입력이면 늘 같은 자리다(무작위가 아니다). 입력 순서가 달라도 같다", () => {
    const a = layoutDotX(points, 80, 5, 1.2);
    const b = layoutDotX(points, 80, 5, 1.2);
    const c = layoutDotX([...points].reverse(), 80, 5, 1.2);

    expect([...a.entries()]).toEqual([...b.entries()]);
    expect([...a.entries()].sort()).toEqual([...c.entries()].sort());
  });

  it("모든 점이 칸 안(15~85%)에 든다", () => {
    for (const fraction of layoutDotX(points, 80, 5, 1.2).values()) {
      expect(fraction).toBeGreaterThanOrEqual(0.15);
      expect(fraction).toBeLessThanOrEqual(0.85);
    }
  });

  it("높이가 비슷한 점은 줄이 남아 있는 동안 서로 다른 가로 자리를 갖는다", () => {
    const crowded = [dot(1, 90), dot(2, 90), dot(3, 90), dot(4, 90)];

    const xs = layoutDotX(crowded, 80, 4, 1.2);

    expect(new Set(xs.values()).size).toBe(4);
  });

  it("줄이 하나면 모두 가운데에 서고, 높이가 멀리 떨어진 점은 옆 줄로 밀리지 않는다", () => {
    const one = layoutDotX([dot(1, 95), dot(2, 70)], 80, 1, 1.2);
    expect([one.get(1), one.get(2)]).toEqual([0.5, 0.5]);

    // 높이가 멀리 떨어진 두 점은 해시가 고른 줄 그대로다(서로를 피해 옮기지 않는다)
    const far = layoutDotX([dot(1, 95), dot(2, 70)], 80, 6, 1.2);
    expect(far.get(1)).toBe(layoutDotX([dot(1, 95)], 80, 6, 1.2).get(1));
    expect(far.get(2)).toBe(layoutDotX([dot(2, 70)], 80, 6, 1.2).get(2));
  });

  it("폴더(salt)가 다르면 같은 유저도 다른 자리일 수 있다(모든 폴더에서 같은 세로줄로 서지 않게)", () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8];
    const first = ids.map((id) => layoutDotX([dot(id, 90)], 80, 6, 1.2).get(id));
    const second = ids.map((id) => layoutDotX([dot(id, 90)], 81, 6, 1.2).get(id));
    expect(first).not.toEqual(second);
  });
});

describe("폴더 구간 칩", () => {
  const bucketsOf = (...tiers: [number, number][]) =>
    buildBuckets(
      tiers.map(([tier, n]) => folder(tier, ...Array.from({ length: n }, (_, i): [number, number, number] => [i + 1, 1, 80]))),
      Array.from({ length: 10 }, (_, i) => user(i + 1, null)),
      "0.1",
      3,
    );

  it("0.1 단위는 기준 난이도 1.0 폭, 0.5 단위는 2.0 폭으로 나누고 칩 글자는 `6.0~6.9` 꼴이다", () => {
    const one = buildWindows(bucketsOf([5.8, 3], [6.0, 3], [6.9, 3], [7.0, 3]), "0.1");
    expect(one.map((w) => [w.start, w.label, w.points])).toEqual([
      [5, "5.0~5.9", 3],
      [6, "6.0~6.9", 6],
      [7, "7.0~7.9", 3],
    ]);

    const half = buildBuckets([folder(5.8, [1, 1, 80], [2, 1, 80], [3, 1, 80]), folder(7.5, [1, 1, 80], [2, 1, 80], [3, 1, 80])], [user(1, null), user(2, null), user(3, null)], "0.5", 3);
    expect(buildWindows(half, "0.5").map((w) => w.label)).toEqual(["4.0~5.9", "6.0~7.9"]);
    expect(windowOf(half[1], "0.5")).toBe(6);
  });

  it("가장 점이 많은 구간이 기본이고 같으면 낮은 쪽, 점이 없으면 null", () => {
    expect(busiestWindow(buildWindows(bucketsOf([5.8, 3], [6.0, 4], [6.1, 4]), "0.1"))).toBe(6);
    expect(busiestWindow(buildWindows(bucketsOf([5.8, 3], [6.0, 3]), "0.1"))).toBe(5);
    expect(busiestWindow(buildWindows(bucketsOf([5.8, 2]), "0.1"))).toBeNull();   // 표본 부족뿐
  });

  it("기본 티어군은 점이 가장 많은 군이고 점이 없으면 all", () => {
    const users = [user(1, "RED"), user(2, "GOLD"), user(3, "BRONZE"), user(4, "IRIDESCENT")];
    const [bucket] = buildBuckets([folder(6.0, [1, 1, 80], [2, 1, 80], [3, 1, 80], [4, 1, 80])], users, "0.1", 3);

    expect(busiestGroup([bucket])).toBe("mid");   // Gold·Bronze·Iridescent 3개 vs Red 1개
    expect(busiestGroup([])).toBe("all");
  });
});
