import { describe, expect, it } from "vitest";
import { avgPercent, bandLabel, formatAvgDiff, hasNoMine, patternValue, type WeaknessAnalysisResponse } from "@/lib/weakness";

describe("formatAvgDiff", () => {
  it("앞서면 +, 뒤지면 진짜 마이너스(U+2212), 같으면 ±, 둘째 자리까지", () => {
    expect(formatAvgDiff(2.35)).toEqual({ text: "+2.35%", sign: "up" });
    expect(formatAvgDiff(-2.35)).toEqual({ text: "−2.35%", sign: "down" });
    expect(formatAvgDiff(0)).toEqual({ text: "±0.00%", sign: "even" });
  });

  it("부동소수점 찌꺼기를 지운다(−0.00·+0.00이 나오지 않는다)", () => {
    expect(formatAvgDiff(0.001)).toEqual({ text: "±0.00%", sign: "even" });
    expect(formatAvgDiff(-0.004)).toEqual({ text: "±0.00%", sign: "even" });
    expect(formatAvgDiff(0.1 + 0.2 - 0.3)).toEqual({ text: "±0.00%", sign: "even" });
    expect(formatAvgDiff(-0.01)).toEqual({ text: "−0.01%", sign: "down" });
  });

  it("값이 없으면 null", () => {
    expect(formatAvgDiff(null)).toBeNull();
    expect(formatAvgDiff(undefined)).toBeNull();
    expect(formatAvgDiff(Number.NaN)).toBeNull();
  });
});

describe("막대·라벨 보조 함수", () => {
  it("막대 길이는 0~100으로 자른다", () => {
    expect(avgPercent(87.12)).toBe(87.12);
    expect(avgPercent(null)).toBe(0);
    expect(avgPercent(120)).toBe(100);
    expect(avgPercent(-3)).toBe(0);
  });

  it("난이도대 라벨은 0.1 단위 두 값으로 `5.5~5.9`, 속성 키는 화면 라벨 값으로 바뀐다", () => {
    expect(bandLabel(5.5, 5.9)).toBe("5.5~5.9");
    expect(bandLabel(6, 6.4)).toBe("6.0~6.4");
    expect(patternValue("SINGLE")).toBe("단일");
    expect(patternValue("COMPOUND")).toBe("복합");
    expect(patternValue("DOUBLE")).toBe("이중");
    expect(patternValue("TRIPLE")).toBe("삼중");
  });

  it("속성 네 줄이 모두 내 곡 0이면 분석할 것이 없다", () => {
    const base = { tierName: null, bandUsers: 0, peerAvailable: false, minChartsPerBand: 3, bandWidth: 0.5, bands: [], weakBandFrom: null, easyCharts: [] };
    const row = (pattern: "SINGLE" | "COMPOUND" | "DOUBLE" | "TRIPLE", myCharts: number) => ({ pattern, myCharts, myAvg: null, peerAvg: null, peerUsers: null, diff: null });
    const empty: WeaknessAnalysisResponse = { ...base, patterns: [row("SINGLE", 0), row("COMPOUND", 0), row("DOUBLE", 0), row("TRIPLE", 0)] };
    const some: WeaknessAnalysisResponse = { ...empty, patterns: [row("SINGLE", 2), row("COMPOUND", 0), row("DOUBLE", 0), row("TRIPLE", 0)] };
    expect(hasNoMine(empty)).toBe(true);
    expect(hasNoMine(some)).toBe(false);
  });
});
