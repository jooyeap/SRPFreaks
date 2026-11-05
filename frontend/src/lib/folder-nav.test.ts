import { describe, expect, it } from "vitest";
import { judgeSwipe, neighborGroups, SWIPE_MIN_PX } from "@/lib/folder-nav";
import type { TierGroupResponse } from "@/lib/api-types";

function group(tier: number | null): TierGroupResponse {
  return { tier, total: 1, recorded: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries: [] };
}
// 서버 순서: 높은 난이도 먼저
const groups = [group(5.9), group(5.8), group(5.7)];

describe("neighborGroups", () => {
  it("가운데 난이도는 아래/위 이웃이 모두 있다", () => {
    const n = neighborGroups(groups, 5.8);
    expect(n.lower?.tier).toBe(5.7);
    expect(n.higher?.tier).toBe(5.9);
  });
  it("가장 낮은 난이도는 아래 이웃이 없고, 가장 높은 난이도는 위 이웃이 없다", () => {
    expect(neighborGroups(groups, 5.7)).toMatchObject({ lower: null, higher: { tier: 5.8 } });
    expect(neighborGroups(groups, 5.9)).toMatchObject({ lower: { tier: 5.8 }, higher: null });
  });
  it("목록에 없는 난이도나 빈 목록이면 이웃이 없다", () => {
    expect(neighborGroups(groups, 7.7)).toEqual({ lower: null, higher: null });
    expect(neighborGroups([], 5.8)).toEqual({ lower: null, higher: null });
  });
});

describe("judgeSwipe", () => {
  it("왼쪽으로 60px 이상 쓸면 더 높은 난이도, 오른쪽이면 더 낮은 난이도", () => {
    expect(judgeSwipe(-SWIPE_MIN_PX, 0)).toBe("higher");
    expect(judgeSwipe(SWIPE_MIN_PX, 0)).toBe("lower");
    expect(judgeSwipe(-120, 30)).toBe("higher");
  });
  it("60px 미만이면 무시한다 (경계: 59는 아니고 60은 맞다)", () => {
    expect(judgeSwipe(59, 0)).toBeNull();
    expect(judgeSwipe(-59, 0)).toBeNull();
    expect(judgeSwipe(60, 0)).toBe("lower");
  });
  it("세로 이동이 같거나 더 크면 무시한다", () => {
    expect(judgeSwipe(80, 80)).toBeNull();
    expect(judgeSwipe(-80, 100)).toBeNull();
    expect(judgeSwipe(80, -79)).toBe("lower");
  });
});
