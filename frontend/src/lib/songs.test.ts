import { describe, expect, it } from "vitest";
import type { SongChartResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import {
  entriesOfSong,
  findChart,
  formatBpm,
  formatNoteCount,
  neighbors,
  parseId,
  parseOrigin,
  resolveChart,
  sortCharts,
} from "@/lib/songs";

function chart(over: Partial<SongChartResponse> & { id: number }): SongChartResponse {
  return { songId: 1, instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9, noteCount: null, ...over };
}

function entry(over: Partial<TableEntryResponse> & { songDifficultyId: number }): TableEntryResponse {
  return {
    entryId: over.songDifficultyId,
    songId: 1,
    title: "곡",
    addedVersion: null,
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9,
    tierUncertain: false,
    recommend: null,
    recommendUncertain: false,
    pattern: null,
    patternUncertain: false,
    mine: null,
    ...over,
  };
}

function group(tier: number | null, entries: TableEntryResponse[]): TierGroupResponse {
  return {
    tier,
    total: entries.length,
    recorded: 0,
    exc: 0,
    fc: 0,
    ss: 0,
    s: 0,
    belowS: 0,
    averageRecorded: null,
    averageWithZero: 0,
    entries,
  };
}

describe("parseOrigin / parseId", () => {
  it("table만 서열표에서 온 것으로 보고, 나머지는 곡 목록으로 취급한다", () => {
    expect(parseOrigin("table")).toBe("table");
    expect(parseOrigin("songs")).toBe("songs");
    expect(parseOrigin("TABLE")).toBe("songs");
    expect(parseOrigin(null)).toBe("songs");
    expect(parseOrigin("<script>")).toBe("songs");
  });

  it("양의 정수 문자열만 id로 받는다", () => {
    expect(parseId("42")).toBe(42);
    expect(parseId("0")).toBeNull();
    expect(parseId("-1")).toBeNull();
    expect(parseId("1.5")).toBeNull();
    expect(parseId("12abc")).toBeNull();
    expect(parseId("")).toBeNull();
    expect(parseId(null)).toBeNull();
    expect(parseId(["1", "2"])).toBeNull();
    expect(parseId("99999999999999999999")).toBeNull();
  });
});

describe("채보 정렬과 선택", () => {
  const charts = [
    chart({ id: 1, instrumentPart: "BASS", difficultyType: "MASTER", level: 8.5 }),
    chart({ id: 2, instrumentPart: "GUITAR", difficultyType: "EXTREME", level: 7.2 }),
    chart({ id: 3, instrumentPart: "GUITAR", difficultyType: "BASIC", level: 2.1 }),
    chart({ id: 4, instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9.8 }),
  ];

  it("Guitar 먼저, 같은 파트 안에서는 BAS -> MAS 순", () => {
    expect(sortCharts(charts).map((c) => c.id)).toEqual([3, 2, 4, 1]);
    expect(charts.map((c) => c.id)).toEqual([1, 2, 3, 4]); // 원본은 그대로
  });

  it("요청한 채보가 이 곡의 것이면 그것을 고른다", () => {
    expect(resolveChart(charts, 2)?.id).toBe(2);
  });

  it("요청이 없거나 다른 곡의 채보 id이면 레벨이 가장 높은 채보를 고른다", () => {
    expect(resolveChart(charts, null)?.id).toBe(4);
    expect(resolveChart(charts, 9999)?.id).toBe(4);
  });

  it("채보가 없으면 null", () => {
    expect(resolveChart([], 1)).toBeNull();
  });
});

describe("표기", () => {
  it("BPM: 같으면 하나, 범위면 ~, 없으면 –", () => {
    expect(formatBpm(150, 150)).toBe("150");
    expect(formatBpm(120, 180)).toBe("120~180");
    expect(formatBpm(null, 180)).toBe("180");
    expect(formatBpm(120, null)).toBe("120");
    expect(formatBpm(null, null)).toBe("–");
  });

  it("노트 수: 천 단위 쉼표, 없으면 –", () => {
    expect(formatNoteCount(1234)).toBe("1,234");
    expect(formatNoteCount(0)).toBe("0");
    expect(formatNoteCount(null)).toBe("–");
    expect(formatNoteCount(undefined)).toBe("–");
  });
});

describe("서열표 전체에서 찾기", () => {
  const a = entry({ songDifficultyId: 10, songId: 1, level: 9.8 });
  const b = entry({ songDifficultyId: 11, songId: 2, level: 9.5 });
  const c = entry({ songDifficultyId: 12, songId: 3, level: 9.0 });
  const d = entry({ songDifficultyId: 13, songId: 1, part: "BASS", difficulty: "EXTREME", level: 7 });
  const e = entry({ songDifficultyId: 14, songId: 1, part: "GUITAR", difficulty: "BASIC", level: 2 });
  const groups = [group(5.8, [a, b, c]), group(null, [d, e])];

  it("채보가 속한 묶음과 위치를 찾는다 (미정 묶음 포함)", () => {
    expect(findChart(groups, 11)).toMatchObject({ index: 1, entry: b });
    expect(findChart(groups, 11)?.group.tier).toBe(5.8);
    expect(findChart(groups, 13)?.group.tier).toBeNull();
    expect(findChart(groups, 999)).toBeNull();
  });

  it("앞/뒤 곡은 같은 묶음 안에서만 찾는다", () => {
    expect(neighbors(groups[0], 0)).toEqual({ prev: null, next: b });
    expect(neighbors(groups[0], 1)).toEqual({ prev: a, next: c });
    expect(neighbors(groups[0], 2)).toEqual({ prev: b, next: null });
    expect(neighbors(group(5.0, [a]), 0)).toEqual({ prev: null, next: null });
  });

  it("곡의 채보를 묶음에 상관없이 모아 (파트, 난이도) 순으로 돌려준다", () => {
    expect(entriesOfSong(groups, 1).map((x) => x.songDifficultyId)).toEqual([14, 10, 13]);
    expect(entriesOfSong(groups, 777)).toEqual([]);
  });
});
