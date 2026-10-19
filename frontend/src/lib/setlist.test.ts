import { describe, expect, it } from "vitest";
import type { SetlistItemResponse } from "@/lib/api-types";
import { doneCount, formatOffsetRange, formatTierOffset } from "@/lib/setlist";

function item(id: number, done: boolean): SetlistItemResponse {
  return {
    id, songDifficultyId: id, songId: id, title: `곡${id}`, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 6,
    mine: null, done, createdAt: "2026-10-16T05:00:00Z",
  };
}

describe("doneCount", () => {
  it("완료한 줄만 센다", () => {
    expect(doneCount([])).toBe(0);
    expect(doneCount([item(1, true), item(2, false), item(3, true)])).toBe(2);
  });
});

describe("추천 범위 표기", () => {
  it("부호가 보이게 쓴다(음수는 평균보다 쉬운 곡)", () => {
    expect(formatTierOffset(-0.6)).toBe("\u22120.6");
    expect(formatTierOffset(0.4)).toBe("+0.4");
    expect(formatTierOffset(0)).toBe("\u00b10");
    expect(formatTierOffset(-0.25)).toBe("\u22120.25");
  });

  it("범위를 `평균 하한 ~ 상한`으로 쓴다", () => {
    expect(formatOffsetRange(-0.6, -0.1)).toBe("평균 \u22120.6 ~ \u22120.1");
    expect(formatOffsetRange(-0.1, 0.4)).toBe("평균 \u22120.1 ~ +0.4");
  });
});
