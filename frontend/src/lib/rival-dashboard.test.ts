import { describe, expect, it } from "vitest";
import type { RivalDetailRow, RivalPatternSummary } from "@/lib/api-types";
import {
  barMax,
  barPercent,
  detailFilterParam,
  isPatternKey,
  isSmallSample,
  mergePreview,
  parseChart,
  parseDetailFilter,
  parseTab,
  tabPatterns,
  topPattern,
} from "@/lib/rival-dashboard";

function pattern(key: RivalPatternSummary["key"], over: Partial<RivalPatternSummary> = {}): RivalPatternSummary {
  return { pattern: key, key, wins: 0, ties: 0, losses: 0, scoreDiffSum: 0, closeCount: 0, sharedCount: 0, ...over };
}
function row(id: number, diff: number): RivalDetailRow {
  return {
    songDifficultyId: id, songId: 100 + id, title: `Song ${id}`, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 5.4, pattern: "단일",
    rate: 95, stage: "SS", score: 240, myRate: 95, myStage: "SS", myScore: 240 + diff, diff,
  };
}

const patterns = [
  pattern("SINGLE", { wins: 6, ties: 1, losses: 2, scoreDiffSum: 30.5, closeCount: 2, sharedCount: 9 }),
  pattern("COMPOUND", { wins: 1, losses: 0, scoreDiffSum: 4, closeCount: 5, sharedCount: 6 }),
  pattern("COMPOSITE_SINGLE", { wins: 4, ties: 1, losses: 5, scoreDiffSum: -18, closeCount: 2, sharedCount: 10 }),
  pattern("DOUBLE"),
  pattern("TRIPLE", { wins: 0, ties: 2, losses: 3, scoreDiffSum: -42.67, closeCount: 0, sharedCount: 5 }),
];

describe("tabPatterns", () => {
  it("우세 탭은 합계가 0보다 큰 속성을 합계 큰 순으로 담는다", () => {
    expect(tabPatterns(patterns, "strong").map((p) => p.key)).toEqual(["SINGLE", "COMPOUND"]);
  });
  it("열세 탭은 합계가 0보다 작은 속성을 합계 작은 순(많이 진 순)으로 담는다", () => {
    expect(tabPatterns(patterns, "weak").map((p) => p.key)).toEqual(["TRIPLE", "COMPOSITE_SINGLE"]);
  });
  it("접전 탭은 접전 곡이 있는 속성을 접전 곡 많은 순으로 담고, 같은 값이면 서버 순서를 지킨다", () => {
    // COMPOUND 5 → SINGLE 2 = COMPOSITE_SINGLE 2 (서버 순서: SINGLE이 먼저)
    expect(tabPatterns(patterns, "close").map((p) => p.key)).toEqual(["COMPOUND", "SINGLE", "COMPOSITE_SINGLE"]);
  });
  it("합계가 0.00이거나 곡이 없는 속성은 우세·열세에 들지 않는다(0곡·합계 0)", () => {
    const zero = [pattern("SINGLE"), pattern("DOUBLE", { ties: 3, sharedCount: 3 })];
    expect(tabPatterns(zero, "strong")).toEqual([]);
    expect(tabPatterns(zero, "weak")).toEqual([]);
    expect(tabPatterns(zero, "close")).toEqual([]);
  });
  it("부동소수점 찌꺼기(±0.004)는 0으로 본다", () => {
    const tiny = [pattern("SINGLE", { scoreDiffSum: 0.004 }), pattern("DOUBLE", { scoreDiffSum: -0.004 })];
    expect(tabPatterns(tiny, "strong")).toEqual([]);
    expect(tabPatterns(tiny, "weak")).toEqual([]);
  });
  it("한 곡뿐인 속성도 그대로 담긴다(1곡)", () => {
    const one = [pattern("TRIPLE", { wins: 1, scoreDiffSum: 2.5, sharedCount: 1 })];
    expect(tabPatterns(one, "strong")).toHaveLength(1);
    expect(isSmallSample(one[0])).toBe(true);
  });
});

describe("topPattern", () => {
  it("탭의 맨 위 속성을, 없으면 null을 돌려준다", () => {
    expect(topPattern(patterns, "strong")?.key).toBe("SINGLE");
    expect(topPattern(patterns, "weak")?.key).toBe("TRIPLE");
    expect(topPattern(patterns, "close")?.key).toBe("COMPOUND");
    expect(topPattern([pattern("SINGLE")], "strong")).toBeNull();
  });
});

describe("막대 길이", () => {
  it("모든 속성 중 가장 큰 승·패 수를 100%로 놓고 비례한다", () => {
    const max = barMax(patterns);
    expect(max).toBe(6);
    expect(barPercent(6, max)).toBe(100);
    expect(barPercent(3, max)).toBe(50);
    expect(barPercent(0, max)).toBe(0);
  });
  it("전부 0이면 0이고 나눗셈이 터지지 않는다", () => {
    expect(barMax([pattern("SINGLE")])).toBe(0);
    expect(barPercent(0, 0)).toBe(0);
    expect(barPercent(2, 0)).toBe(0);
  });
});

describe("공유 곡이 5곡 미만", () => {
  it("4곡은 참고용, 5곡부터는 아니다", () => {
    expect(isSmallSample(pattern("SINGLE", { sharedCount: 4 }))).toBe(true);
    expect(isSmallSample(pattern("SINGLE", { sharedCount: 5 }))).toBe(false);
    expect(isSmallSample(pattern("SINGLE", { sharedCount: 0 }))).toBe(true);
  });
});

describe("mergePreview", () => {
  it("우세는 크게 앞선 순으로 2곡, 같은 값이면 채보 id 순이다", () => {
    const merged = mergePreview([[row(1, 5), row(2, 9)], [row(3, 9), row(4, 1)]], "strong");
    expect(merged.map((r) => r.songDifficultyId)).toEqual([2, 3]);
  });
  it("열세는 크게 뒤진 순으로 2곡이다", () => {
    const merged = mergePreview([[row(1, -2), row(2, -9)], [row(3, -4)]], "weak");
    expect(merged.map((r) => r.songDifficultyId)).toEqual([2, 3]);
  });
  it("접전은 차이(절댓값)가 작은 순으로 3곡이다", () => {
    const merged = mergePreview([[row(1, -0.9), row(2, 0.1)], [row(3, 0), row(4, 1)]], "close");
    expect(merged.map((r) => r.songDifficultyId)).toEqual([3, 2, 1]);
  });
  it("곡이 없으면 빈 목록이다", () => {
    expect(mergePreview([[], []], "weak")).toEqual([]);
  });
});

describe("주소 값 해석", () => {
  it("탭은 허용 값만 받고 모르는 값은 우세로 본다", () => {
    expect(parseTab("weak")).toBe("weak");
    expect(parseTab("close")).toBe("close");
    expect(parseTab("nope")).toBe("strong");
    expect(parseTab(null)).toBe("strong");
  });
  it("차트는 막대·점 분포·레이더만 받고 모르는 값은 막대로 본다", () => {
    expect(parseChart("bar")).toBe("bar");
    expect(parseChart("dot")).toBe("dot");
    expect(parseChart("radar")).toBe("radar");
    expect(parseChart("pie")).toBe("bar");
    expect(parseChart(null)).toBe("bar");
  });
  it("필터는 소문자 값을 서버 값으로 바꾸고 모르는 값은 전체로 본다", () => {
    expect(parseDetailFilter("lose")).toBe("LOSE");
    expect(parseDetailFilter("win")).toBe("WIN");
    expect(parseDetailFilter("close")).toBe("CLOSE");
    expect(parseDetailFilter("zzz")).toBe("ALL");
    expect(parseDetailFilter(null)).toBe("ALL");
    expect(detailFilterParam("LOSE")).toBe("lose");
  });
  it("속성 키는 허용 다섯 가지만 통과한다", () => {
    expect(isPatternKey("COMPOSITE_SINGLE")).toBe(true);
    expect(isPatternKey("EXCLUDED")).toBe(false);
    expect(isPatternKey("single")).toBe(false);
  });
});
