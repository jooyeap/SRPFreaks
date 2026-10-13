import { describe, expect, it } from "vitest";
import { achievementStage, isHigherStage, STAGE_ORDER } from "@/lib/stage";

/** 백엔드 AchievementStageTest와 같은 경계값. 둘이 어긋나면 미리보기와 저장 결과가 달라진다. */
describe("achievementStage (백엔드와 같은 구간)", () => {
  it.each([
    [0, "C"],
    [62.99, "C"],
    [63, "B"],
    [72.99, "B"],
    [73, "A"],
    [79.99, "A"],
    [80, "S"],
    [94.99, "S"],
    [95, "SS"],
    [99.99, "SS"],
    [100, "EXC"],
  ] as const)("달성률 %s, FC 아님 -> %s", (rate, expected) => {
    expect(achievementStage(rate, false)).toBe(expected);
  });

  it("FC이면 달성률이 낮아도 FC 단계다 (96%이면서 FC -> FC)", () => {
    expect(achievementStage(96, true)).toBe("FC");
    expect(achievementStage(70, true)).toBe("FC");
    expect(achievementStage(0, true)).toBe("FC");
  });

  it("100.00은 FC 여부와 상관없이 EXC다", () => {
    expect(achievementStage(100, true)).toBe("EXC");
    expect(achievementStage(100, false)).toBe("EXC");
  });

  it("기록이 없으면 null (기록이 있으면 항상 단계가 있다)", () => {
    expect(achievementStage(null, false)).toBeNull();
    expect(achievementStage(undefined, true)).toBeNull();
    expect(achievementStage(Number.NaN, false)).toBeNull();
  });

  it("소수 오차가 있는 값도 경계를 바르게 판정한다", () => {
    expect(achievementStage(0.1 + 0.2 + 94.69, false)).toBe("S"); // 94.99000000000001 같은 값 -> 9499
    expect(achievementStage(72.999999999, false)).toBe("A"); // 반올림하면 73.00
  });
});

describe("단계 순서", () => {
  it("낮은 단계에서 높은 단계 순서다", () => {
    expect(STAGE_ORDER).toEqual(["C", "B", "A", "S", "SS", "FC", "EXC"]);
  });

  it("isHigherStage로 높낮이를 비교한다", () => {
    expect(isHigherStage("FC", "SS")).toBe(true);
    expect(isHigherStage("S", "A")).toBe(true);
    expect(isHigherStage("B", "A")).toBe(false);
    expect(isHigherStage("S", "S")).toBe(false);
  });
});
