import { describe, expect, it } from "vitest";
import type { PlayerTierResponse } from "@/lib/api-types";
import { skillKeys, tierProgress } from "@/lib/rating";

const orange: PlayerTierResponse = {
  key: "ORANGE",
  displayName: "Orange",
  minScore: 1000,
  nextDisplayName: "Orange Gradient",
  nextMinScore: 1500,
};
const top: PlayerTierResponse = {
  key: "HASUBONG",
  displayName: "하수봉",
  minScore: 9500,
  nextDisplayName: null,
  nextMinScore: null,
};

describe("tierProgress", () => {
  it("구간 안의 위치와 다음 티어까지 남은 점수를 계산한다", () => {
    const p = tierProgress(1125, orange);
    expect(p?.ratio).toBeCloseTo(0.25);
    expect(p?.remaining).toBe(375);
    expect(p?.nextDisplayName).toBe("Orange Gradient");
  });

  it("구간 시작점이면 0, 다음 티어 직전이면 1에 가깝다", () => {
    expect(tierProgress(1000, orange)?.ratio).toBe(0);
    expect(tierProgress(1499.99, orange)?.ratio).toBeCloseTo(0.99998, 4);
  });

  it("마지막 티어는 null (화면에는 '최고 티어')", () => {
    expect(tierProgress(9800, top)).toBeNull();
  });

  it("반올림 때문에 합계가 구간 밖으로 보여도 막대와 남은 점수를 범위 안으로 맞춘다", () => {
    expect(tierProgress(999.99, orange)?.ratio).toBe(0);
    expect(tierProgress(1500.0, orange)).toMatchObject({ ratio: 1, remaining: 0 });
    expect(tierProgress(1500.01, orange)).toMatchObject({ ratio: 1, remaining: 0 });
  });

  it("합계가 0이어도 오류 없이 계산한다", () => {
    const white: PlayerTierResponse = { key: "WHITE", displayName: "White", minScore: 0, nextDisplayName: "White Gradient", nextMinScore: 500 };
    expect(tierProgress(0, white)).toMatchObject({ ratio: 0, remaining: 500 });
  });
});

describe("skillKeys", () => {
  it("사용자 id를 키에 넣고, 기록 변경 때 무효화되는 'skill' 키로 시작한다", () => {
    expect(skillKeys.me(3)).toEqual(["skill", 3]);
    expect(skillKeys.me(3)).not.toEqual(skillKeys.me(4));
  });
});
