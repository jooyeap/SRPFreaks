import { describe, expect, it } from "vitest";
import type { SetlistItemResponse } from "@/lib/api-types";
import { doneCount } from "@/lib/setlist";

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
