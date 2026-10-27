import { describe, expect, it } from "vitest";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { ratingEntryThreshold } from "@/lib/rating-threshold";

/** rank와 score만 쓰는 목록 줄. 나머지는 이 계산이 보지 않는다 */
function entries(count: number, lastScore: number): SkillEntryResponse[] {
  return Array.from({ length: count }, (_, i) => ({ rank: i + 1, score: i + 1 === count ? lastScore : lastScore + 50 }) as SkillEntryResponse);
}

function skillOf(single: SkillEntryResponse[], other: SkillEntryResponse[]): SkillResponse {
  return { single, other, singleLimit: 15, otherLimit: 25 } as SkillResponse;
}

/*
 * 손으로 계산한 값 (기준 난이도 6.0 → R = 10×6.0−45 = 15, 점수 = V×20)
 *  맨 아래 점수 240 → V=12 = 15×0.8 → 정확히 80%                → 안내 80
 *  맨 아래 점수 258 → V=12.9, 가산 0.9 → 80+0.9/3.2×15 = 84.22  → 안내 85
 *  맨 아래 점수 300 → V=15,   가산 3.0 → 80+3.0/3.2×15 = 94.07  → 안내 95
 */
describe("ratingEntryThreshold", () => {
  it("두 목록이 가득 차면 더 쉬운 쪽(필요한 달성률이 낮은 쪽)을 쓴다", () => {
    expect(ratingEntryThreshold(skillOf(entries(15, 258), entries(25, 300)), "6.0")).toBe(85);
    expect(ratingEntryThreshold(skillOf(entries(15, 300), entries(25, 258)), "6.0")).toBe(85);
  });

  it("점수가 정확히 80%에 해당하면 80이다", () => {
    expect(ratingEntryThreshold(skillOf(entries(15, 240), entries(25, 300)), "6.0")).toBe(80);
  });

  it("필요한 달성률을 다음 안내 단계로 올린다 (94.07 → 95)", () => {
    expect(ratingEntryThreshold(skillOf(entries(15, 300), entries(25, 300)), "6.0")).toBe(95);
  });

  it("한쪽만 가득 찼으면 그쪽만 본다", () => {
    expect(ratingEntryThreshold(skillOf(entries(10, 100), entries(25, 258)), "6.0")).toBe(85);
  });

  it("두 목록 모두 덜 찼으면 계산하지 않는다", () => {
    expect(ratingEntryThreshold(skillOf(entries(14, 258), entries(24, 258)), "6.0")).toBeNull();
    expect(ratingEntryThreshold(skillOf([], []), "6.0")).toBeNull();
  });

  it("어떤 달성률로도 넘지 못하는 점수면 계산하지 않는다 (6.0 구간은 95%여도 최대 점수 340을 넘지 못함)", () => {
    expect(ratingEntryThreshold(skillOf(entries(15, 400), entries(25, 400)), "6.0")).toBeNull();
  });

  it("합쳐진 줄이나 읽을 수 없는 키는 계산하지 않는다", () => {
    const skill = skillOf(entries(15, 258), entries(25, 258));
    expect(ratingEntryThreshold(skill, "merged-high")).toBeNull();
    expect(ratingEntryThreshold(skill, "미정")).toBeNull();
  });
});
