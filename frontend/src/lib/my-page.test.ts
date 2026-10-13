import { describe, expect, it } from "vitest";
import type { ChartFolderListResponse, ChartFolderResponse } from "@/lib/api-types";
import { overallStages, tabFromParam, tabToQuery } from "@/lib/my-page";

function folder(over: Partial<ChartFolderResponse>): ChartFolderResponse {
  return {
    lo: 9, hi: 9.5, total: 10, recorded: 5, exc: 1, fc: 1, ss: 1, s: 1, belowS: 1,
    averageRecorded: null, averageWithZero: 0, subFolders: [], ...over,
  };
}

describe("tabFromParam / tabToQuery", () => {
  it("stats만 통계 탭이고, 없거나 알 수 없는 값은 레이팅 탭이다", () => {
    expect(tabFromParam("stats")).toBe("stats");
    expect(tabFromParam("rating")).toBe("rating");
    expect(tabFromParam(null)).toBe("rating");
    expect(tabFromParam("<script>")).toBe("rating");
  });

  it("기본 탭(레이팅)은 주소에 쓰지 않는다", () => {
    expect(tabToQuery("rating")).toBe("");
    expect(tabToQuery("stats")).toBe("tab=stats");
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
