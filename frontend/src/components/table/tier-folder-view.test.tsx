import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TierFolderView } from "@/components/table/TierFolderView";
import type { DifficultyTableResponse, PageResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

const table: DifficultyTableResponse = {
  id: 3,
  name: "SRN+ 서열표",
  instrumentPart: "GUITAR",
  noteOption: "SUPER_RANDOM_PLUS",
  status: "ACTIVE",
  revision: 1,
};

function entry(id: number, title: string): TableEntryResponse {
  return {
    entryId: id,
    songDifficultyId: id,
    songId: id,
    title,
    addedVersion: "V5",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend: "상",
    recommendUncertain: false,
    pattern: "단일",
    patternUncertain: false,
    ratingEnabled: true,
    mine: null,
  };
}

function group(tier: number | null, titles: string[]): TierGroupResponse {
  return {
    tier,
    total: titles.length,
    recorded: 0,
    exc: 0,
    fc: 0,
    ss: 0,
    s: 0,
    belowS: 0,
    averageRecorded: null,
    averageWithZero: 0,
    entries: titles.map((t, i) => entry(tier === null ? 900 + i : Math.round(tier * 100) + i, t)),
  };
}

describe("TierFolderView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const groups = [group(5.8, ["가곡", "나곡"]), group(5.0, ["다곡"]), group(null, ["미정곡"])];

  function json(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  function renderView(param: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <TierFolderView userId={1} param={param} />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => {
      const page: PageResponse<TierGroupResponse> = { content: groups, page: 0, size: 20, totalElements: 3, totalPages: 1 };
      return Promise.resolve(String(input).includes("/entries") ? json(page) : json([table]));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("주소의 기준 난이도에 해당하는 묶음 하나만 보여 준다", async () => {
    renderView("5.8");
    expect(await screen.findByRole("heading", { name: /5\.8\s*2개/ })).toBeInTheDocument();
    expect(screen.getAllByText("가곡").length).toBeGreaterThan(0);
    expect(screen.queryByText("다곡")).not.toBeInTheDocument(); // 다른 묶음은 나오지 않는다
    expect(screen.getByRole("link", { name: "서열표로" })).toHaveAttribute("href", "/table");
  });

  it("undecided는 기준 난이도가 없는 `미정` 묶음이다", async () => {
    renderView("undecided");
    expect(await screen.findByRole("heading", { name: /미정/ })).toBeInTheDocument();
    expect(screen.getAllByText("미정곡").length).toBeGreaterThan(0);
  });

  it("없는 묶음 주소는 `묶음을 찾을 수 없습니다.`", async () => {
    renderView("7.7");
    expect(await screen.findByRole("alert")).toHaveTextContent("묶음을 찾을 수 없습니다.");
  });
});
