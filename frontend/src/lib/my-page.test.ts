import { describe, expect, it } from "vitest";
import type { ChartFolderListResponse, ChartFolderResponse } from "@/lib/api-types";
import {
  MY_PAGE_SUB_VIEWS,
  MY_PAGE_TABS,
  hasSubViews,
  isLegacyMyPageQuery,
  myPageStateFromParams,
  myPageStateToQuery,
  overallStages,
  tabFromParam,
} from "@/lib/my-page";

function folder(over: Partial<ChartFolderResponse>): ChartFolderResponse {
  return {
    lo: 9, hi: 9.5, total: 10, recorded: 5, exc: 1, fc: 1, ss: 1, s: 1, belowS: 1,
    averageRecorded: null, averageWithZero: 0, subFolders: [], ...over,
  };
}

describe("tabFromParam", () => {
  it("stats·list·rival은 그 탭이고, 없거나 알 수 없는 값은 레이팅 탭이다", () => {
    expect(tabFromParam("stats")).toBe("stats");
    expect(tabFromParam("rival")).toBe("rival");
    expect(tabFromParam("list")).toBe("list");
    expect(tabFromParam("rating")).toBe("rating");
    expect(tabFromParam(null)).toBe("rating");
    expect(tabFromParam("<script>")).toBe("rating");
  });

  it("옛 값 setlist는 리스트 탭으로 읽는다", () => {
    expect(tabFromParam("setlist")).toBe("list");
  });
});

describe("myPageState 주소 변환", () => {
  it("기본값(레이팅 탭, 레벨 폴더, 기본 하위 전환)은 주소에 쓰지 않는다", () => {
    expect(myPageStateToQuery({ tab: "rating", axis: "level", view: null })).toBe("");
    // 레이팅 탭에서는 기준이 의미가 없어 쓰지 않는다
    expect(myPageStateToQuery({ tab: "rating", axis: "tier", view: null })).toBe("");
    expect(myPageStateToQuery({ tab: "stats", axis: "level", view: null })).toBe("tab=stats");
    expect(myPageStateToQuery({ tab: "list", axis: "tier", view: null })).toBe("tab=list"); // 기준(axis)은 통계 탭에서만 의미가 있다
    expect(myPageStateToQuery({ tab: "stats", axis: "tier", view: null })).toBe("tab=stats&axis=tier");
    expect(myPageStateToQuery({ tab: "rival", axis: "level", view: null })).toBe("tab=rival");
  });

  it("레이팅 탭의 분석은 ?tab=rating&view=analysis 이다", () => {
    expect(myPageStateToQuery({ tab: "rating", axis: "level", view: "analysis" })).toBe("tab=rating&view=analysis");
  });

  it("그 탭에 없는 하위 전환은 주소에 쓰지 않는다", () => {
    expect(myPageStateToQuery({ tab: "stats", axis: "level", view: "analysis" })).toBe("tab=stats");
    expect(myPageStateToQuery({ tab: "list", axis: "level", view: "analysis" })).toBe("tab=list");
  });

  it("주소에서 읽고, 알 수 없는 값은 기본값으로 본다", () => {
    expect(myPageStateFromParams(new URLSearchParams("tab=stats&axis=tier"))).toEqual({ tab: "stats", axis: "tier", view: null });
    expect(myPageStateFromParams(new URLSearchParams("tab=list"))).toEqual({ tab: "list", axis: "level", view: null });
    expect(myPageStateFromParams(new URLSearchParams("tab=rating&view=analysis"))).toEqual({ tab: "rating", axis: "level", view: "analysis" });
    expect(myPageStateFromParams(new URLSearchParams("tab=x&axis=y"))).toEqual({ tab: "rating", axis: "level", view: null });
    expect(myPageStateFromParams(new URLSearchParams(""))).toEqual({ tab: "rating", axis: "level", view: null });
  });

  it("그 탭에 없는 view 값은 버린다", () => {
    expect(myPageStateFromParams(new URLSearchParams("tab=stats&view=analysis")).view).toBeNull();
    expect(myPageStateFromParams(new URLSearchParams("tab=list&view=analysis")).view).toBeNull();
    expect(myPageStateFromParams(new URLSearchParams("tab=rating&view=<script>")).view).toBeNull();
  });

  it("옛 주소 ?tab=setlist는 리스트 탭, ?tab=analysis는 레이팅 탭의 분석으로 읽고 새 주소로 바꿔 쓴다", () => {
    const setlist = myPageStateFromParams(new URLSearchParams("tab=setlist"));
    expect(setlist).toEqual({ tab: "list", axis: "level", view: null });
    expect(myPageStateToQuery(setlist)).toBe("tab=list");

    const analysis = myPageStateFromParams(new URLSearchParams("tab=analysis"));
    expect(analysis).toEqual({ tab: "rating", axis: "level", view: "analysis" });
    expect(myPageStateToQuery(analysis)).toBe("tab=rating&view=analysis");
  });
});

describe("isLegacyMyPageQuery", () => {
  it("옛 탭 값(setlist, analysis)만 true", () => {
    expect(isLegacyMyPageQuery(new URLSearchParams("tab=setlist"))).toBe(true);
    expect(isLegacyMyPageQuery(new URLSearchParams("tab=analysis"))).toBe(true);
    expect(isLegacyMyPageQuery(new URLSearchParams("tab=list"))).toBe(false);
    expect(isLegacyMyPageQuery(new URLSearchParams("tab=rating&view=analysis"))).toBe(false);
    expect(isLegacyMyPageQuery(new URLSearchParams(""))).toBe(false);
  });
});

describe("하위 전환 표시 조건", () => {
  it("항목이 2개 이상일 때만 그린다: 레이팅 탭(내 레이팅 · 분석)과 리스트 탭(세트리스트 · 내 리스트)은 그리고 통계·라이벌은 그리지 않는다", () => {
    expect(hasSubViews(MY_PAGE_SUB_VIEWS.rating)).toBe(true);
    expect(hasSubViews(MY_PAGE_SUB_VIEWS.list)).toBe(true);
    expect(hasSubViews(MY_PAGE_SUB_VIEWS.stats)).toBe(false);
    expect(hasSubViews(MY_PAGE_SUB_VIEWS.rival)).toBe(false);
  });

  it("상위 탭은 레이팅 · 통계 · 리스트 · 라이벌 네 개다", () => {
    expect(MY_PAGE_TABS.map((tab) => tab.value)).toEqual(["rating", "stats", "list", "rival"]);
  });
});

describe("overallStages", () => {
  it("모든 폴더의 단계별 개수와 전체·기록 수를 더한다", () => {
    const list: ChartFolderListResponse = {
      totalSongs: 2, totalCharts: 30, versions: [],
      folders: [folder({}), folder({ lo: 8, total: 20, recorded: 8, exc: 2, fc: 0, ss: 3, s: 2, belowS: 1 })],
    };
    expect(overallStages(list)).toEqual({ exc: 3, fc: 1, ss: 4, s: 3, belowS: 2, total: 30, recorded: 13 });
  });

  it("폴더가 없으면 모두 0이다", () => {
    expect(overallStages({ totalSongs: 0, totalCharts: 0, versions: [], folders: [] })).toEqual({
      exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, total: 0, recorded: 0,
    });
  });
});
