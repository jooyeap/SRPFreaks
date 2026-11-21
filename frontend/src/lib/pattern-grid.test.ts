import { describe, expect, it } from "vitest";
import type { AchievementStage } from "@/lib/types";
import type { TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { EMPTY_FILTERS, DEFAULT_FILTERS } from "@/lib/difficulty-table";
import { buildPatternGrid, parseGridPattern, patternFolderHref } from "@/lib/pattern-grid";

function entry(id: number, pattern: string | null, stage: string | null, recommend = "상"): TableEntryResponse {
  return {
    entryId: id,
    songDifficultyId: id,
    songId: id,
    title: `곡${id}`,
    addedVersion: "V1",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend,
    recommendUncertain: false,
    pattern,
    patternUncertain: false,
    ratingEnabled: true,
    mine: stage === null ? null : { rate: 90, fullCombo: false, stage: stage as AchievementStage },
  };
}

function group(tier: number | null, entries: TableEntryResponse[]): TierGroupResponse {
  return { tier, total: entries.length, recorded: 0, exc: 0, fc: 0, ss: 0, sPlus: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries };
}

describe("parseGridPattern (주소의 ?pattern= 화이트리스트)", () => {
  it("단일·복합·이중·삼중만 받고 나머지는 null", () => {
    expect(parseGridPattern("복합")).toBe("복합");
    expect(parseGridPattern("단일")).toBe("단일");
    expect(parseGridPattern("이중")).toBe("이중");
    expect(parseGridPattern("삼중")).toBe("삼중");
    expect(parseGridPattern("복합(단일)")).toBeNull(); // 열이 아니다
    expect(parseGridPattern("레이팅 제외")).toBeNull();
    expect(parseGridPattern("<script>")).toBeNull();
    expect(parseGridPattern("")).toBeNull();
    expect(parseGridPattern(null)).toBeNull();
  });
});

describe("patternFolderHref", () => {
  it("폴더 주소 뒤에 인코딩한 속성을 붙인다", () => {
    expect(patternFolderHref("/table/folder/5.7", "복합")).toBe(`/table/folder/5.7?pattern=${encodeURIComponent("복합")}`);
    expect(decodeURIComponent(patternFolderHref("/table/folder/5.7", "복합"))).toBe("/table/folder/5.7?pattern=복합");
  });
});

describe("buildPatternGrid (폴더 × 속성 집계)", () => {
  const groups = [
    group(5.8, [
      entry(1, "단일", "SS"),
      entry(2, "단일", "S"),
      entry(3, "단일", null),
      entry(4, "복합", "EXC"),
      entry(5, "복합(단일)", "S"), // 어느 열에도 세지 않는다
      entry(6, "레이팅 제외", "S"),
      entry(7, null, null),
      entry(8, "이중", "A", "하"), // 추천 `하`: 기본 필터(상·중)에서 빠진다
    ]),
    group(5.7, [entry(9, "삼중", null)]),
    group(5.6, [entry(10, "단일", null, "하")]), // 기본 필터에서 모두 빠지는 행
    group(null, [entry(11, "단일", "S")]), // 미정 묶음은 행이 아니다
  ];

  it("칸마다 기록/전체와 단계 개수를 센다 (직접 센 값)", () => {
    const grid = buildPatternGrid(groups, EMPTY_FILTERS);
    const row = grid.rows.find((r) => r.tier === 5.8)!;
    expect(row.cells.단일).toEqual({ total: 3, recorded: 2, exc: 0, fc: 0, ss: 1, sPlus: 0, s: 1, belowS: 0 });
    expect(row.cells.복합).toEqual({ total: 1, recorded: 1, exc: 1, fc: 0, ss: 0, sPlus: 0, s: 0, belowS: 0 });
    expect(row.cells.이중).toEqual({ total: 1, recorded: 1, exc: 0, fc: 0, ss: 0, sPlus: 0, s: 0, belowS: 1 });
    expect(row.cells.삼중.total).toBe(0);
  });

  it("복합(단일)·레이팅 제외·속성 없음은 어느 칸에도 세지 않는다 (칸의 합 < 폴더 전체)", () => {
    const grid = buildPatternGrid(groups, EMPTY_FILTERS);
    const row = grid.rows.find((r) => r.tier === 5.8)!;
    const sum = Object.values(row.cells).reduce((acc, c) => acc + c.total, 0);
    expect(sum).toBe(5); // 8곡 중 단일 3 + 복합 1 + 이중 1
  });

  it("열 머리의 채보 수는 행의 합이다", () => {
    const grid = buildPatternGrid(groups, EMPTY_FILTERS);
    expect(grid.columnTotals).toEqual({ 단일: 4, 복합: 1, 이중: 1, 삼중: 1 });
  });

  it("추천 필터는 칸에도 적용하고(기본 상·중), 걸러져 채보가 하나도 없는 행은 만들지 않는다. 미정 묶음도 행이 아니다", () => {
    const grid = buildPatternGrid(groups, DEFAULT_FILTERS);
    expect(grid.rows.map((r) => r.tier).sort()).toEqual([5.7, 5.8]);
    expect(grid.rows.find((r) => r.tier === 5.8)!.cells.이중.total).toBe(0);
    expect(grid.columnTotals).toEqual({ 단일: 3, 복합: 1, 이중: 0, 삼중: 1 });
  });

  it("필터의 속성 값은 무시한다 (열이 속성이다)", () => {
    const withPat = buildPatternGrid(groups, { ...EMPTY_FILTERS, pattern: ["복합"] });
    expect(withPat).toEqual(buildPatternGrid(groups, EMPTY_FILTERS));
  });
});
