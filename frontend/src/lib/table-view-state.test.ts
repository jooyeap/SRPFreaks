import { describe, expect, it } from "vitest";
import {
  clearTableReturn,
  DEFAULT_VIEW_STATE,
  folderStartFilters,
  readTableReturn,
  rememberTableReturn,
  tableReturnHref,
  viewStateFromParams,
  viewStateToQuery,
  type TableViewState,
} from "@/lib/table-view-state";

const parse = (query: string) => viewStateFromParams(new URLSearchParams(query));

describe("서열표 보기 상태 <-> 주소 쿼리", () => {
  it("주소가 비어 있으면 기본 상태(추천 상·중, 레벨 순, 0% 미포함, 1페이지)이고, 기본 상태는 빈 주소다", () => {
    expect(parse("")).toEqual(DEFAULT_VIEW_STATE);
    expect(viewStateToQuery(DEFAULT_VIEW_STATE)).toBe("");
  });

  it("모든 값을 담았다가 같은 상태로 되돌린다", () => {
    const state: TableViewState = {
      filters: { part: null, recommend: ["상"], pattern: ["단일", "복합"] },
      sort: "rateDesc",
      includeZero: true,
      page: 2,
      order: "easy",
    };
    const query = viewStateToQuery(state);
    expect(query).toBe(new URLSearchParams({ rec: "상", pat: "단일,복합", sort: "rateDesc", zero: "1", page: "3", order: "easy" }).toString());
    expect(parse(query)).toEqual(state);
  });

  it("타일 순서(order)는 hard·easy만 받고, 알 수 없는 값이나 없으면 null(기본)이다", () => {
    expect(parse("order=hard").order).toBe("hard");
    expect(parse("order=easy").order).toBe("easy");
    expect(parse("order=zzz").order).toBeNull();
    expect(parse("").order).toBeNull();
    expect(viewStateToQuery({ ...DEFAULT_VIEW_STATE, order: "hard" })).toBe("order=hard");
  });

  it("옛 주소의 파트(part)는 무시한다(서열표 파트 필터 없음, 2026-10-31)", () => {
    expect(parse("part=B").filters.part).toBeNull();
  });

  it("추천 필터를 전부 푼 상태(전체)는 `rec=all`로 기본값(상·중)과 구분된다", () => {
    const all: TableViewState = { ...DEFAULT_VIEW_STATE, filters: { part: null, recommend: [], pattern: [] } };
    expect(viewStateToQuery(all)).toBe("rec=all");
    expect(parse("rec=all").filters.recommend).toEqual([]);
    expect(parse("").filters.recommend).toEqual(["상", "중"]);
  });

  it("값의 순서와 상관없이 같은 선택이면 같은 상태가 된다 (옵션 순서로 맞춤)", () => {
    expect(parse("pat=삼중,단일").filters.pattern).toEqual(["단일", "삼중"]);
    expect(parse("rec=중,상").filters.recommend).toEqual(["상", "중"]);
  });

  it("알 수 없는 값은 버리고 기본값으로 돌린다 (주소는 사용자가 고칠 수 있다)", () => {
    const s = parse("part=X&rec=최상&pat=없음&sort=hack&zero=yes&page=abc");
    expect(s.filters).toEqual({ part: null, recommend: ["상", "중"], pattern: [] }); // 알 수 없는 rec는 기본값
    expect(s.sort).toBe("level");
    expect(s.includeZero).toBe(false);
    expect(s.page).toBe(0);
  });

  it("페이지는 1부터 보이고 내부는 0부터이며, 1 이하·소수·음수는 첫 페이지, 너무 큰 값은 상한으로 줄인다", () => {
    expect(parse("page=2").page).toBe(1);
    expect(parse("page=1").page).toBe(0);
    expect(parse("page=0").page).toBe(0);
    expect(parse("page=-3").page).toBe(0);
    expect(parse("page=2.5").page).toBe(0);
    expect(parse("page=99999").page).toBe(999);
  });
});

describe("서열표 -> 폴더 복귀 기억", () => {
  it("기억이 없으면 `←`는 /table, 폴더 시작 필터는 필터 없음(묶음 전체)이다", () => {
    expect(readTableReturn()).toBeNull();
    expect(tableReturnHref()).toBe("/table");
    expect(folderStartFilters()).toEqual({ part: null, recommend: [], pattern: [] });
  });

  it("기억한 쿼리로 `←` 주소와 폴더 시작 필터가 정해진다 (기본 쿼리는 추천 상·중)", () => {
    rememberTableReturn({ query: "", scrollY: 10, unfolded: false });
    expect(tableReturnHref()).toBe("/table");
    expect(folderStartFilters().recommend).toEqual(["상", "중"]);
    rememberTableReturn({ query: "rec=all&pat=%EB%B3%B5%ED%95%A9", scrollY: 10, unfolded: false });
    expect(tableReturnHref()).toBe("/table?rec=all&pat=%EB%B3%B5%ED%95%A9");
    expect(folderStartFilters()).toEqual({ part: null, recommend: [], pattern: ["복합"] });
  });

  it("메모리가 비어도 sessionStorage 값을 읽고, 모양이 틀린 값은 없는 것으로 본다", () => {
    sessionStorage.setItem("srp.tableReturn", JSON.stringify({ query: "rec=all", scrollY: 5, unfolded: true }));
    expect(readTableReturn()).toEqual({ query: "rec=all", scrollY: 5, unfolded: true });
    clearTableReturn();
    for (const bad of ["not json", JSON.stringify({ query: 1, scrollY: 5, unfolded: true }), JSON.stringify({ query: "", scrollY: -3, unfolded: false })]) {
      sessionStorage.setItem("srp.tableReturn", bad);
      expect(readTableReturn()).toBeNull();
    }
  });

  it("clearTableReturn은 기억을 지운다", () => {
    rememberTableReturn({ query: "", scrollY: 1, unfolded: false });
    clearTableReturn();
    expect(readTableReturn()).toBeNull();
    expect(sessionStorage.getItem("srp.tableReturn")).toBeNull();
  });
});
