import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DifficultyTableResponse, TierGroupResponse } from "@/lib/api-types";
import {
  decidedGroups,
  EMPTY_FILTERS,
  fetchAllTierGroups,
  fetchTableEntries,
  findGroupByParam,
  folderHref,
  groupAverage,
  joinFilter,
  pickRatingTable,
  RECOMMEND_OPTIONS,
  tierParam,
  toggleValue,
} from "@/lib/difficulty-table";

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

describe("묶음 주소 (tierParam / findGroupByParam / folderHref)", () => {
  it("레이팅 상수 난이도는 소수 첫째 자리 문자열, 없으면 undecided", () => {
    expect(tierParam(5.8)).toBe("5.8");
    expect(tierParam(6)).toBe("6.0");
    expect(tierParam(null)).toBe("undecided");
    expect(folderHref(5.8)).toBe("/table/folder/5.8");
    expect(folderHref(null)).toBe("/table/folder/undecided");
  });

  it("주소 조각으로 묶음을 찾고, 없는 값이면 null", () => {
    const groups = [{ tier: 6 }, { tier: 5.8 }, { tier: null }] as TierGroupResponse[];
    expect(findGroupByParam(groups, "6.0")).toBe(groups[0]);
    expect(findGroupByParam(groups, "5.8")).toBe(groups[1]);
    expect(findGroupByParam(groups, "undecided")).toBe(groups[2]);
    expect(findGroupByParam(groups, "5.80")).toBeNull();
    expect(findGroupByParam(groups, "abc")).toBeNull();
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
    await fetchTableEntries(3, { part: "BASS", recommend: ["상"], pattern: [] }, 2);
    const url = String(fetchMock.mock.calls[0][0]);
    const params = new URL(url, "http://x").searchParams;
    expect(url.startsWith("/api/v1/difficulty-tables/3/entries?")).toBe(true);
    expect(params.get("part")).toBe("BASS");
    expect(params.get("recommend")).toBe("상");
    expect(params.has("pattern")).toBe(false);
    expect(params.get("mine")).toBe("true");
    expect(params.get("page")).toBe("2");
  });

  it("추천·속성을 여러 개 고르면 쉼표로 이어 한 값으로 보낸다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    await fetchTableEntries(3, { part: null, recommend: ["상", "중"], pattern: ["단일", "삼중"] }, 0);
    const params = new URL(String(fetchMock.mock.calls[0][0]), "http://x").searchParams;
    expect(params.get("recommend")).toBe("상,중");
    expect(params.get("pattern")).toBe("단일,삼중");
  });

  it("필터가 모두 '전체'이면 part/recommend/pattern을 보내지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    await fetchTableEntries(1, EMPTY_FILTERS, 0);
    const params = new URL(String(fetchMock.mock.calls[0][0]), "http://x").searchParams;
    expect([...params.keys()].sort()).toEqual(["mine", "page"]);
  });
});

describe("toggleValue / joinFilter", () => {
  it("없으면 넣고 있으면 뺀다", () => {
    expect(toggleValue([], "상", RECOMMEND_OPTIONS)).toEqual(["상"]);
    expect(toggleValue(["상"], "상", RECOMMEND_OPTIONS)).toEqual([]);
  });

  it("누른 순서와 상관없이 옵션 순서로 정렬한다 (같은 선택은 같은 키)", () => {
    expect(toggleValue(["하"], "상", RECOMMEND_OPTIONS)).toEqual(["상", "하"]);
    expect(toggleValue(["상", "하"], "중", RECOMMEND_OPTIONS)).toEqual(["상", "중", "하"]);
  });

  it("입력 배열을 바꾸지 않는다", () => {
    const input = ["상"];
    toggleValue(input, "중", RECOMMEND_OPTIONS);
    expect(input).toEqual(["상"]);
  });

  it("joinFilter는 비면 null, 아니면 쉼표로 잇는다", () => {
    expect(joinFilter([])).toBeNull();
    expect(joinFilter(["상", "중"])).toBe("상,중");
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
    expect(params.get("undecided")).toBe("true"); // 곡 상세·홈은 미정 채보도 찾아야 한다
  });

  it("서버가 totalPages를 터무니없이 크게 줘도 정해진 횟수에서 멈춘다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(page([{ tier: 5 }], 0, 999999)));
    const groups = await fetchAllTierGroups(1);
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(groups).toHaveLength(10);
  });
});

describe("decidedGroups", () => {
  it("기준 난이도가 없는 미정 묶음만 뺀다", () => {
    const groups = [{ tier: 6.0 }, { tier: 5.9 }, { tier: null }] as TierGroupResponse[];
    expect(decidedGroups(groups).map((g) => g.tier)).toEqual([6.0, 5.9]);
  });
});
