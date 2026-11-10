import { describe, expect, it } from "vitest";
import {
  DETAIL_SWIPE_RULES,
  dragOffsetPx,
  dragPassed,
  FOLDER_EDGE_PULL_PX,
  FOLDER_SWIPE_RULES,
  folderProgressPercent,
  judgeSwipe,
  neighborGroups,
  SWIPE_MIN_PX,
} from "@/lib/folder-nav";
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

describe("judgeSwipe (곡 상세 규칙: 80px, 가로축 30° 이내)", () => {
  it("79px는 무시하고 80px부터 인정한다", () => {
    expect(judgeSwipe(-79, 0, DETAIL_SWIPE_RULES)).toBeNull();
    expect(judgeSwipe(-80, 0, DETAIL_SWIPE_RULES)).toBe("higher");
    expect(judgeSwipe(80, 0, DETAIL_SWIPE_RULES)).toBe("lower");
  });
  it("30° 안쪽만 인정한다 (dx 100 기준 dy 57은 안쪽, 58은 바깥)", () => {
    expect(judgeSwipe(-100, 57, DETAIL_SWIPE_RULES)).toBe("higher");
    expect(judgeSwipe(-100, -57, DETAIL_SWIPE_RULES)).toBe("higher");
    expect(judgeSwipe(-100, 58, DETAIL_SWIPE_RULES)).toBeNull();
    expect(judgeSwipe(100, 80, DETAIL_SWIPE_RULES)).toBeNull();
  });
});

describe("folderProgressPercent (하단 알약 진행 막대)", () => {
  it("0/전체 = 0, 전체/전체 = 100", () => {
    expect(folderProgressPercent(0, 18)).toBe(0);
    expect(folderProgressPercent(18, 18)).toBe(100);
  });
  it("5/18 = 5÷18×100 = 27.777...% (소수 셋째 자리까지)", () => {
    expect(folderProgressPercent(5, 18)).toBe(27.778);
  });
  it("전체가 0이면 0, 범위를 벗어나면 0~100으로 고정", () => {
    expect(folderProgressPercent(0, 0)).toBe(0);
    expect(folderProgressPercent(3, 0)).toBe(0);
    expect(folderProgressPercent(20, 18)).toBe(100);
    expect(folderProgressPercent(-1, 18)).toBe(0);
  });
});

describe("D68: 서열표 폴더 스와이프 규칙과 끌기 계산", () => {
  it("폴더 규칙은 곡 상세와 같다 (80px, 30°, 가장자리 24px)", () => {
    expect(FOLDER_SWIPE_RULES).toEqual({ minPx: 80, maxAngleDeg: 30, edgePx: 24 });
    expect(FOLDER_SWIPE_RULES).toEqual(DETAIL_SWIPE_RULES);
    expect(judgeSwipe(-79, 0, FOLDER_SWIPE_RULES)).toBeNull();
    expect(judgeSwipe(-80, 0, FOLDER_SWIPE_RULES)).toBe("higher");
  });
  it("끌기 중 목록은 이동량의 절반만 움직인다 (이웃이 있을 때)", () => {
    expect(dragOffsetPx(-30, true)).toBe(-15);
    expect(dragOffsetPx(100, true)).toBe(50);
    expect(dragOffsetPx(0, true)).toBe(0);
  });
  it("끝 난이도(이웃 없음)에서는 22px까지만 따라간다", () => {
    expect(dragOffsetPx(-30, false)).toBe(-15);
    expect(dragOffsetPx(-44, false)).toBe(-22);
    expect(dragOffsetPx(-300, false)).toBe(-22);
    expect(dragOffsetPx(300, false)).toBe(22);
    expect(FOLDER_EDGE_PULL_PX).toBe(22);
  });
  it("80px부터 `놓으면 이동` 구간이다", () => {
    expect(dragPassed(-79)).toBe(false);
    expect(dragPassed(-80)).toBe(true);
    expect(dragPassed(120)).toBe(true);
  });
});
