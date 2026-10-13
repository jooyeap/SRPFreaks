import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartRowResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { matchTableCharts, normalizeQuery, searchCharts, SEARCH_PAGE_SIZE, tableSearchHref } from "@/lib/table-search";

function entry(over: Partial<TableEntryResponse>): TableEntryResponse {
  return {
    entryId: 1,
    songDifficultyId: 10,
    songId: 100,
    title: "곡",
    addedVersion: null,
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend: null,
    recommendUncertain: false,
    pattern: null,
    patternUncertain: false,
    ratingEnabled: true,
    mine: null,
    ...over,
  };
}

function group(tier: number | null, entries: TableEntryResponse[]): TierGroupResponse {
  return { tier, entries } as TierGroupResponse;
}

function row(songDifficultyId: number, songId = 100): ChartRowResponse {
  return {
    songDifficultyId,
    songId,
    title: "곡",
    addedVersion: null,
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    mine: null,
  };
}

describe("matchTableCharts", () => {
  const groups = [
    group(6.0, [entry({ entryId: 1, songDifficultyId: 10 }), entry({ entryId: 2, songDifficultyId: 11 })]),
    group(null, [entry({ entryId: 3, songDifficultyId: 12 })]),
  ];

  it("서열표에 있는 채보만 남기고 레이팅 상수 난이도를 붙인다 (미정 묶음은 null)", () => {
    const results = matchTableCharts(groups, [row(10), row(12)]);
    expect(results.map((r) => [r.entry.songDifficultyId, r.tier])).toEqual([
      [10, 6.0],
      [12, null],
    ]);
  });

  it("서열표에 없는 채보는 빠지고, 서버가 준 순서를 지킨다", () => {
    const results = matchTableCharts(groups, [row(11), row(999), row(10)]);
    expect(results.map((r) => r.entry.songDifficultyId)).toEqual([11, 10]);
  });

  it("검색 결과가 없으면 빈 목록", () => {
    expect(matchTableCharts(groups, [])).toEqual([]);
    expect(matchTableCharts([], [row(10)])).toEqual([]);
  });
});

describe("tableSearchHref / normalizeQuery", () => {
  it("서열표 정보가 나오는 곡 상세 주소", () => {
    expect(tableSearchHref({ songId: 7, songDifficultyId: 42 })).toBe("/songs/7?from=table&chart=42");
  });

  it("앞뒤 공백을 뺀다", () => {
    expect(normalizeQuery("  abc  ")).toBe("abc");
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("searchCharts", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("곡 목록 검색 API에 검색어와 최대 크기로 요청한다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    await searchCharts("  sample ");
    const params = new URL(String(fetchMock.mock.calls[0][0]), "http://x").searchParams;
    expect(String(fetchMock.mock.calls[0][0]).startsWith("/api/v1/songs/charts?")).toBe(true);
    expect(params.get("q")).toBe("sample");
    expect(params.get("page")).toBe("0");
    expect(params.get("size")).toBe(String(SEARCH_PAGE_SIZE));
  });
});
