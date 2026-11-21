import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import {
  PROGRESS_PATTERN_KEY,
  groupsForPattern,
  parseProgressPattern,
  patternCountsFromServer,
  patternCountsOfGroups,
  patternParam,
  resetProgressPatternForTest,
  setProgressPattern,
} from "@/lib/progress-pattern";

/** 속성과 내 기록 단계만 가진 서열표 줄 (필터가 보는 값만 채운다) */
function entry(pattern: string | null, stage: string | null): TableEntryResponse {
  return {
    part: "GUITAR",
    recommend: null,
    pattern,
    mine: stage === null ? null : { rate: 90, fullCombo: false, stage },
  } as unknown as TableEntryResponse;
}

function group(tier: number, entries: TableEntryResponse[]): TierGroupResponse {
  return {
    tier,
    total: entries.length,
    recorded: 0,
    exc: 0,
    fc: 0,
    ss: 0,
    sPlus: 0,
    s: 0,
    belowS: 0,
    averageRecorded: null,
    averageWithZero: 0,
    entries,
  };
}

// 6.0 묶음: 단일 EXC, 단일 기록 없음, 복합 S+, 속성 없음 SS / 5.0 묶음: 이중 A
const groups = [
  group(6.0, [entry("단일", "EXC"), entry("단일", null), entry("복합", "S+"), entry(null, "SS")]),
  group(5.0, [entry("이중", "A")]),
];

describe("parseProgressPattern / patternParam", () => {
  it("칩에 있는 값만 받고 나머지는 전체로 본다", () => {
    expect(parseProgressPattern("단일")).toBe("단일");
    expect(parseProgressPattern("삼중")).toBe("삼중");
    expect(parseProgressPattern("all")).toBe("all");
    for (const bad of ["복합(단일)", "레이팅 제외", "SINGLE", "", null, undefined, 1]) {
      expect(parseProgressPattern(bad)).toBe("all");
    }
  });
  it("전체는 서버 파라미터를 보내지 않는다", () => {
    expect(patternParam("all")).toBeNull();
    expect(patternParam("복합")).toBe("복합");
  });
});

describe("속성별 채보 수", () => {
  it("서열표 탭: 전체는 묶음 합계이고, 속성이 없는 채보는 어느 칩에도 세지 않는다", () => {
    expect(patternCountsOfGroups(groups)).toEqual({ all: 5, 단일: 2, 복합: 1, 이중: 1, 삼중: 0 });
  });
  it("곡 목록 탭: 서버가 준 속성별 개수와 전체를 쓴다(없는 키는 0)", () => {
    expect(patternCountsFromServer(669, { 단일: 300, 복합: 200 })).toEqual({ all: 669, 단일: 300, 복합: 200, 이중: 0, 삼중: 0 });
    expect(patternCountsFromServer(0, undefined)).toEqual({ all: 0, 단일: 0, 복합: 0, 이중: 0, 삼중: 0 });
  });
});

describe("groupsForPattern (필터 전환 재집계)", () => {
  it("전체는 그대로다(속성이 없는 채보 포함)", () => {
    const all = groupsForPattern(groups, "all");
    expect(all).toHaveLength(2);
    expect(all[0].total).toBe(4);
  });
  it("단일만 고르면 그 채보로 개수를 다시 세고 단계도 다시 센다", () => {
    const single = groupsForPattern(groups, "단일");
    expect(single).toHaveLength(1);
    expect(single[0]).toMatchObject({ tier: 6.0, total: 2, recorded: 1, exc: 1, sPlus: 0, belowS: 0 });
  });
  it("복합은 S+ 하나이고, 채보가 없는 난이도 행(5.0)은 숨긴다", () => {
    const compound = groupsForPattern(groups, "복합");
    expect(compound.map((g) => g.tier)).toEqual([6.0]);
    expect(compound[0]).toMatchObject({ total: 1, recorded: 1, sPlus: 1 });
  });
  it("이중은 5.0 행만 남고 S 미만으로 센다", () => {
    const double = groupsForPattern(groups, "이중");
    expect(double.map((g) => g.tier)).toEqual([5.0]);
    expect(double[0]).toMatchObject({ total: 1, recorded: 1, belowS: 1 });
  });
  it("채보가 하나도 없는 속성(삼중)은 빈 목록이다", () => {
    expect(groupsForPattern(groups, "삼중")).toEqual([]);
  });
});

describe("선택한 속성의 기기별 기억", () => {
  beforeEach(() => {
    localStorage.clear();
    resetProgressPatternForTest();
  });
  afterEach(() => vi.restoreAllMocks());

  it("속성 값 하나만 localStorage에 저장한다", () => {
    setProgressPattern("이중");
    expect(localStorage.getItem(PROGRESS_PATTERN_KEY)).toBe("이중");
    expect(localStorage.length).toBe(1);
  });

  it("저장소가 막혀도(쓰기 예외) 예외 없이 지나간다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => setProgressPattern("단일")).not.toThrow();
  });
});
