import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DifficultyTableResponse, TierGroupResponse } from "@/lib/api-types";
import { EMPTY_FILTERS, fetchAllTierGroups, fetchTableEntries, groupAverage, pickRatingTable } from "@/lib/difficulty-table";

function table(over: Partial<DifficultyTableResponse>): DifficultyTableResponse {
  return {
    id: 1,
    name: "SRN+ 서열표",
    instrumentPart: "GUITAR",
    noteOption: "SUPER_RANDOM_PLUS",
    status: "ACTIVE",
    revision: 1,
    ...over,
  };
}

describe("pickRatingTable", () => {
  it("ACTIVE + SRN+ 표 중 id가 가장 작은 것을 고른다", () => {
    const picked = pickRatingTable([table({ id: 7 }), table({ id: 3 }), table({ id: 5 })]);
    expect(picked?.id).toBe(3);
  });

  it("INACTIVE이거나 다른 노트 옵션인 표는 고르지 않는다", () => {
    const picked = pickRatingTable([
      table({ id: 1, status: "INACTIVE" }),
      table({ id: 2, noteOption: "NORMAL" }),
      table({ id: 9 }),
    ]);
    expect(picked?.id).toBe(9);
  });

  it("조건에 맞는 표가 없으면 null이고, 입력 배열 순서를 바꾸지 않는다", () => {
    expect(pickRatingTable([table({ noteOption: "RANDOM" })])).toBeNull();
    const input = [table({ id: 8 }), table({ id: 2 })];
    pickRatingTable(input);
    expect(input.map((t) => t.id)).toEqual([8, 2]);
  });
});

describe("groupAverage", () => {
  const group = { averageRecorded: 90.5, averageWithZero: 45.25 } as TierGroupResponse;

  it("미포함이면 기록 있는 채보만의 평균, 포함이면 0% 포함 평균", () => {
    expect(groupAverage(group, false)).toBe(90.5);
    expect(groupAverage(group, true)).toBe(45.25);
  });

  it("기록이 없는 묶음은 미포함 null, 포함 0", () => {
    const empty = { averageRecorded: null, averageWithZero: 0 } as TierGroupResponse;
    expect(groupAverage(empty, false)).toBeNull();
    expect(groupAverage(empty, true)).toBe(0);
  });
});

describe("fetchTableEntries", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("필터가 있는 것만 쿼리로 보내고 mine=true를 붙인다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    await fetchTableEntries(3, { part: "BASS", recommend: "상", pattern: null }, 2);
    const url = String(fetchMock.mock.calls[0][0]);
    const params = new URL(url, "http://x").searchParams;
    expect(url.startsWith("/api/v1/difficulty-tables/3/entries?")).toBe(true);
    expect(params.get("part")).toBe("BASS");
    expect(params.get("recommend")).toBe("상");
    expect(params.has("pattern")).toBe(false);
    expect(params.get("mine")).toBe("true");
    expect(params.get("page")).toBe("2");
  });

  it("필터가 모두 '전체'이면 part/recommend/pattern을 보내지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    await fetchTableEntries(1, EMPTY_FILTERS, 0);
    const params = new URL(String(fetchMock.mock.calls[0][0]), "http://x").searchParams;
    expect([...params.keys()].sort()).toEqual(["mine", "page"]);
  });
});

describe("fetchAllTierGroups", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const page = (groups: unknown[], pageNo: number, totalPages: number) =>
    new Response(JSON.stringify({ content: groups, page: pageNo, size: 20, totalElements: 3, totalPages }), { status: 200 });

  it("마지막 페이지까지 이어 받아 순서대로 합친다", async () => {
    fetchMock.mockResolvedValueOnce(page([{ tier: 6.0 }, { tier: 5.9 }], 0, 2));
    fetchMock.mockResolvedValueOnce(page([{ tier: null }], 1, 2));
    const groups = await fetchAllTierGroups(3);
    expect(groups.map((g) => g.tier)).toEqual([6.0, 5.9, null]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const params = new URL(String(fetchMock.mock.calls[1][0]), "http://x").searchParams;
    expect(params.get("page")).toBe("1");
    expect(params.get("size")).toBe("20");
    expect(params.get("mine")).toBe("true");
  });

  it("서버가 totalPages를 터무니없이 크게 줘도 정해진 횟수에서 멈춘다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(page([{ tier: 5 }], 0, 999999)));
    const groups = await fetchAllTierGroups(1);
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(groups).toHaveLength(10);
  });
});
