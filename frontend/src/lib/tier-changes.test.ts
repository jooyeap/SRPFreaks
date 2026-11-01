import { describe, expect, it } from "vitest";
import type { TierChangeResponse } from "@/lib/api-types";
import { countRecentByTier } from "@/lib/tier-changes";

const NOW = new Date("2026-11-08T12:00:00Z");

function row(changedAt: string, afterTier: number | null): TierChangeResponse {
  return {
    changedAt, created: false, songId: 1, title: "곡", songDifficultyId: 1, part: "GUITAR", difficulty: "MASTER", level: 9,
    beforeTier: 5.5, afterTier, beforePattern: "단일", afterPattern: "단일", beforeRecommend: null, afterRecommend: null,
  };
}

describe("countRecentByTier (묶음 머리 `최근 변경` 칩)", () => {
  const rows = [
    row("2026-11-08T10:00:00Z", 5.6),
    row("2026-11-05T00:00:00Z", 5.6),
    row("2026-11-03T00:00:00Z", 5.7),
    row("2026-11-01T11:59:00Z", 5.7), // 7일보다 1분 오래됨 → 세지 않음
    row("2026-11-07T00:00:00Z", null), // 미정 묶음은 세지 않음
  ];

  it("변경 탭을 본 적이 없으면 최근 7일 안의 변경을 바뀐 뒤의 기준 난이도별로 센다", () => {
    const counts = countRecentByTier(rows, NOW, null);
    expect(counts.get("5.6")).toBe(2);
    expect(counts.get("5.7")).toBe(1);
    expect(counts.size).toBe(2);
  });

  it("변경 탭을 본 뒤에 생긴 변경만 센다", () => {
    const counts = countRecentByTier(rows, NOW, "2026-11-06T00:00:00Z");
    expect(counts.get("5.6")).toBe(1);
    expect(counts.has("5.7")).toBe(false);
  });

  it("탭을 본 지 7일이 넘었으면 7일 기준이고, 저장값이 망가졌으면 무시한다", () => {
    expect(countRecentByTier(rows, NOW, "2026-10-01T00:00:00Z").get("5.6")).toBe(2);
    expect(countRecentByTier(rows, NOW, "not-a-date").get("5.6")).toBe(2);
  });
});
