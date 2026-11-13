import { describe, expect, it } from "vitest";
import { parseTierArrival, tierArrivalHref } from "@/lib/tier-arrival";
import type { TierNotificationResponse } from "@/lib/api-types";

const base = {
  kind: "TIER", id: 1, songId: 9, songDifficultyId: 11, title: "Cosmic Cat", part: "GUITAR", difficulty: "EXTREME",
  level: 8.2, myRate: 90, beforeTier: 6.5, afterTier: 7.0, beforeScore: 322.67, afterScore: 362.67, scoreDiff: 40,
  bundled: false, songCount: 1,
} as unknown as TierNotificationResponse;

describe("서열표 알림 → 곡 상세 도착 값 (D61)", () => {
  it("바뀐 채보와 전·후 값을 주소에 싣고, 다시 읽으면 같은 값이다", () => {
    const href = tierArrivalHref(base);
    expect(href).toBe("/songs/9?chart=11&from=tier-noti&bt=6.5&at=7&bs=322.67&as=362.67");
    const search = new URL(href, "https://x.test").searchParams;
    expect(parseTierArrival(search)).toEqual({ beforeTier: 6.5, afterTier: 7, beforeScore: 322.67, afterScore: 362.67 });
  });

  it("미정(null)은 주소에서 빠지고 읽으면 null이다", () => {
    const href = tierArrivalHref({ ...base, beforeTier: null, beforeScore: null, scoreDiff: null });
    expect(href).not.toContain("bt=");
    expect(href).not.toContain("bs=");
    const got = parseTierArrival(new URL(href, "https://x.test").searchParams);
    expect(got).toEqual({ beforeTier: null, afterTier: 7, beforeScore: null, afterScore: 362.67 });
  });

  it("알림에서 온 게 아니면 null, 숫자가 아닌 값은 미정으로 본다", () => {
    expect(parseTierArrival(new URLSearchParams("from=table&bt=6.5"))).toBeNull();
    expect(parseTierArrival(new URLSearchParams("from=tier-noti&bt=abc&at=7"))?.beforeTier).toBeNull();
  });
});
