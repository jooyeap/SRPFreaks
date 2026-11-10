import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartRowResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import {
  chartIdOfDetailHref,
  chartIdOfDetailLink,
  readDetailNav,
  rememberDetailNav,
  resetDetailNavForTest,
  songsNavView,
  tableNavView,
  updateDetailNavCurrent,
  type DetailNavContext,
} from "@/lib/detail-nav";
import { EMPTY_FILTERS } from "@/lib/difficulty-table";
import { EMPTY_SONG_FILTERS } from "@/lib/song-list";

function entry(id: number, title: string, over: Partial<TableEntryResponse> = {}): TableEntryResponse {
  return {
    entryId: id, songDifficultyId: id, songId: id * 10, title, addedVersion: "V5", part: "GUITAR", difficulty: "MASTER", level: 9, tierUncertain: false,
    recommend: "상", recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true, mine: null, ...over,
  };
}
function group(tier: number | null, entries: TableEntryResponse[]): TierGroupResponse {
  return { tier, total: entries.length, recorded: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries };
}
// 서버 순서: 높은 난이도 먼저
const groups = [group(5.4, [entry(41, "d"), entry(42, "e")]), group(5.3, [entry(31, "a"), entry(32, "b"), entry(33, "c")]), group(5.2, [entry(21, "f")]), group(null, [entry(1, "미정")])];
const table = (over: Partial<Extract<DetailNavContext, { source: "table" }>> = {}): Extract<DetailNavContext, { source: "table" }> => ({
  source: "table", sort: "level", filters: EMPTY_FILTERS, current: 32, ...over,
});

afterEach(() => resetDetailNavForTest());

describe("tableNavView", () => {
  it("묶음 안에서는 앞뒤 채보로 가고 위치는 n/묶음 전체다", () => {
    const v = tableNavView(groups, table(), 32);
    expect(v).toMatchObject({ position: 2, total: 3, tier: 5.3, prev: { kind: "go", chartId: 31 }, next: { kind: "go", chartId: 33 } });
    expect(v?.prev).not.toHaveProperty("tier");
  });
  it("묶음 끝에서 다음은 바로 위 묶음(다음 묶음 5.4)의 첫 채보다", () => {
    expect(tableNavView(groups, table(), 33)?.next).toEqual({ kind: "go", songId: 410, chartId: 41, tier: 5.4 });
  });
  it("묶음 처음에서 이전은 바로 아래 묶음(이전 묶음 5.2)의 마지막 채보다", () => {
    expect(tableNavView(groups, table(), 31)?.prev).toEqual({ kind: "go", songId: 210, chartId: 21, tier: 5.2 });
  });
  it("가장 높은/낮은 묶음의 끝에서는 막힌다(미정 묶음은 이웃이 아니다)", () => {
    expect(tableNavView(groups, table(), 42)?.next).toBeNull();
    expect(tableNavView(groups, table(), 21)?.prev).toBeNull();
  });
  it("정렬을 따른다: 곡명순이면 그 순서로 이웃을 찾는다", () => {
    const g = [group(5.3, [entry(1, "다"), entry(2, "가"), entry(3, "나")])];
    const v = tableNavView(g, table({ sort: "title" }), 3);
    expect(v).toMatchObject({ position: 2, prev: { chartId: 2 }, next: { chartId: 1 } });
  });
  it("필터에서 빠진 채보나 미정 묶음의 채보면 null이다", () => {
    expect(tableNavView(groups, table({ filters: { ...EMPTY_FILTERS, recommend: ["하"] } }), 32)).toBeNull();
    expect(tableNavView(groups, table(), 1)).toBeNull();
    expect(tableNavView(groups, table(), 999)).toBeNull();
  });
  it("필터로 곡이 없어진 묶음은 건너뛴다", () => {
    const g = [group(5.4, [entry(41, "d", { recommend: "하" })]), group(5.3, [entry(31, "a")])];
    expect(tableNavView(g, table({ filters: { ...EMPTY_FILTERS, recommend: ["상"] } }), 31)?.next).toBeNull();
  });
});

describe("songsNavView", () => {
  const row = (id: number): ChartRowResponse => ({ songDifficultyId: id, songId: id * 10 } as ChartRowResponse);
  const rows = [row(1), row(2), row(3)];
  it("받은 목록 안에서 앞뒤로 가고 전체 개수를 쓴다", () => {
    expect(songsNavView(rows, 12, true, 2)).toMatchObject({ position: 2, total: 12, tier: null, prev: { chartId: 1 }, next: { chartId: 3 } });
  });
  it("처음은 이전이 없고, 받은 끝에서 더 있으면 more, 진짜 끝이면 null이다", () => {
    expect(songsNavView(rows, 3, false, 1)?.prev).toBeNull();
    expect(songsNavView(rows, 12, true, 3)?.next).toEqual({ kind: "more" });
    expect(songsNavView(rows, 3, false, 3)?.next).toBeNull();
  });
  it("받은 목록에 없는 채보면 null이다", () => {
    expect(songsNavView(rows, 3, false, 9)).toBeNull();
  });
});

describe("링크 주소 읽기", () => {
  it("곡 상세 링크에서 채보 id를 꺼낸다", () => {
    expect(chartIdOfDetailHref("/songs/5?from=table&chart=77")).toBe(77);
    expect(chartIdOfDetailHref("/songs/5?chart=8&from=songs")).toBe(8);
    expect(chartIdOfDetailHref("/songs/5?from=songs")).toBeNull();
    expect(chartIdOfDetailHref("/table/folder/5.8")).toBeNull();
    expect(chartIdOfDetailHref(null)).toBeNull();
  });
  it("링크 안쪽 요소를 눌러도 찾는다", () => {
    document.body.innerHTML = '<a href="/songs/5?from=songs&chart=9"><span id="x">곡</span></a><button id="y"></button>';
    expect(chartIdOfDetailLink(document.getElementById("x"))).toBe(9);
    expect(chartIdOfDetailLink(document.getElementById("y"))).toBeNull();
  });
});

describe("기억", () => {
  it("저장했다가 읽고 current를 바꾼다", () => {
    rememberDetailNav(table());
    expect(readDetailNav()).toMatchObject({ source: "table", current: 32 });
    updateDetailNavCurrent(33);
    expect(readDetailNav()?.current).toBe(33);
  });
  it("곡 목록 기억은 필터를 주소 쿼리로 저장했다가 되살린다", () => {
    const filters = { ...EMPTY_SONG_FILTERS, part: "BASS" as const, difficulties: ["MASTER" as const] };
    rememberDetailNav({ source: "songs", userId: 1, lo: 9.5, step: "0.50", filters, size: 20, current: 5 });
    // 메모리를 버리고 저장소에서 다시 읽는다
    const raw = sessionStorage.getItem("srp.detailNav");
    resetDetailNavForTest();
    sessionStorage.setItem("srp.detailNav", raw ?? "");
    expect(readDetailNav()).toMatchObject({ source: "songs", lo: 9.5, step: "0.50", filters, size: 20 });
  });
  it("저장소 값이 망가졌으면 없는 것으로 본다", () => {
    resetDetailNavForTest();
    sessionStorage.setItem("srp.detailNav", '{"source":"table","current":"x"}');
    expect(readDetailNav()).toBeNull();
  });
  it("저장소를 못 써도 메모리로 동작한다", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    rememberDetailNav(table());
    expect(readDetailNav()?.current).toBe(32);
    spy.mockRestore();
  });
});
