import { describe, expect, it, vi } from "vitest";

import { koT } from "@/i18n/ko-translator";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { buildCardModel } from "@/lib/rating-card";
import { drawRatingCard } from "@/lib/rating-card-draw";

function entry(rank: number): SkillEntryResponse {
  return {
    rank, songDifficultyId: rank, songId: rank, title: `Song ${rank}`, part: "GUITAR", difficulty: "MASTER", level: 9.45,
    tier: 9, pattern: "단일", achievementRate: 98.03, fullCombo: true, stage: "FC", ratingConstant: 30, value: 10, score: 200,
  };
}

/** jsdom에는 캔버스가 없어서, 어떤 호출이든 받는 가짜 컨텍스트로 "예외 없이 끝까지 그리고 글자를 그렸는지"만 본다. */
function fakeCtx() {
  const calls: Record<string, unknown[][]> = {};
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop === "measureText") return (s: string) => ({ width: s.length * 10 });
      if (prop === "createLinearGradient") return () => ({ addColorStop: vi.fn() });
      if (prop in t) return t[prop];
      return (...args: unknown[]) => {
        (calls[prop] ??= []).push(args);
      };
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("drawRatingCard", () => {
  const skill: SkillResponse = {
    noteOption: "SUPER_RANDOM_PLUS", totalScore: 5210.8, singleScore: 1980.2, otherScore: 3230.6,
    tier: { key: "PURPLE", displayName: "Purple", minScore: 5000, nextDisplayName: null, nextMinScore: null },
    singleLimit: 15, otherLimit: 25, single: [entry(1), entry(2)], other: [entry(1)],
  };

  for (const layout of ["landscape", "portrait"] as const) {
    it(`${layout}: 곡명·합계·문구를 그린다`, () => {
      const model = buildCardModel(layout, skill, koT, { nickname: "Tester", now: new Date("2026-10-22T00:00:00Z") });
      const { ctx, calls } = fakeCtx();
      drawRatingCard(ctx, model, { sans: "sans", num: "num" });
      const drawn = (calls.fillText ?? []).map((a) => a[0]);
      expect(drawn).toEqual(expect.arrayContaining(["Song 1", "Song 2", "5210.80", "Purple", "Tester", model.footerLeft]));
    });
  }

  it("닉네임이 없으면 이름을 그리지 않는다", () => {
    const model = buildCardModel("landscape", skill, koT, { nickname: null, now: new Date() });
    const { ctx, calls } = fakeCtx();
    drawRatingCard(ctx, model, { sans: "sans", num: "num" });
    expect((calls.fillText ?? []).map((a) => a[0])).not.toContain("Tester");
  });
});
