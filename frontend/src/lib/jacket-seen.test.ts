import { beforeEach, describe, expect, it } from "vitest";
import { JACKET_SEEN_LIMIT, isJacketSeen, markJacketSeen, resetJacketSeen } from "@/lib/jacket-seen";

describe("jacket-seen (D82, 모션 PR 6)", () => {
  beforeEach(() => resetJacketSeen());

  it("표시한 주소만 본 것으로 센다", () => {
    expect(isJacketSeen("/jackets/a.webp")).toBe(false);
    markJacketSeen("/jackets/a.webp");
    expect(isJacketSeen("/jackets/a.webp")).toBe(true);
    expect(isJacketSeen("/jackets/b.webp")).toBe(false);
  });

  it("한도를 넘으면 가장 오래된 것부터 버린다", () => {
    for (let i = 0; i < JACKET_SEEN_LIMIT; i++) markJacketSeen(`/jackets/${i}.webp`);
    markJacketSeen("/jackets/new.webp");
    expect(isJacketSeen("/jackets/0.webp")).toBe(false);
    expect(isJacketSeen("/jackets/1.webp")).toBe(true);
    expect(isJacketSeen("/jackets/new.webp")).toBe(true);
  });
});
