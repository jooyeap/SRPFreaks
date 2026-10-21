import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  const mixed = group(5.8, ["가곡", "나곡"]);
  mixed.entries[0] = { ...mixed.entries[0], part: "BASS", recommend: "하", pattern: "복합" };
  const groups = [mixed, group(5.0, ["다곡"]), group(null, ["미정곡"])];

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

  it("주소의 레이팅 상수 난이도에 해당하는 묶음 하나만 보여 준다", async () => {
    renderView("5.8");
    expect(await screen.findByRole("heading", { name: /5\.8\s*2개/ })).toBeInTheDocument();
    expect(screen.getAllByText("가곡").length).toBeGreaterThan(0);
    expect(screen.queryByText("다곡")).not.toBeInTheDocument(); // 다른 묶음은 나오지 않는다
    expect(screen.getByRole("link", { name: "서열표로" })).toHaveAttribute("href", "/table");
  });

  it("묶음 화면 상단에 인접 난이도 막대와 난이도 칩 띠가 있다", async () => {
    renderView("5.8");
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });
    expect(screen.getByRole("navigation", { name: "인접 난이도" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "난이도 목록" })).toBeInTheDocument();
  });

  it("undecided(미정) 주소는 서열표 화면에서 뺐으므로 찾을 수 없다", async () => {
    renderView("undecided");
    expect(await screen.findByRole("alert")).toHaveTextContent("묶음을 찾을 수 없습니다.");
    expect(screen.queryByText("미정곡")).not.toBeInTheDocument();
  });

  it("없는 묶음 주소는 `묶음을 찾을 수 없습니다.`", async () => {
    renderView("7.7");
    expect(await screen.findByRole("alert")).toHaveTextContent("묶음을 찾을 수 없습니다.");
  });

  it("처음에는 필터 없이 묶음 전체를 보여 주고, 파트 칩으로 거르면 머리 개수도 걸러진 채보 기준이다", async () => {
    renderView("5.8");
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });

    const parts = screen.getByRole("group", { name: "파트" });
    expect(within(parts).getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(parts).getByRole("button", { name: "Bass" }));

    expect(await screen.findByRole("heading", { name: /5\.8\s*1개/ })).toBeInTheDocument();
    expect(screen.getAllByText("가곡").length).toBeGreaterThan(0); // Bass인 곡
    expect(screen.queryByText("나곡")).not.toBeInTheDocument();
    // 인접 난이도 막대는 묶음 전체 기준이라 필터와 상관없이 그대로 있다
    expect(screen.getByRole("navigation", { name: "인접 난이도" })).toBeInTheDocument();
  });

  it("추천·속성 칩도 걸리고, 조건에 맞는 채보가 없으면 안내를 보여 준다", async () => {
    renderView("5.8");
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });

    fireEvent.click(within(screen.getByRole("group", { name: "추천" })).getByRole("button", { name: "하" }));
    expect(await screen.findByRole("heading", { name: /5\.8\s*1개/ })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "삼중" }));
    expect(await screen.findByText("조건에 맞는 채보가 없습니다.")).toBeInTheDocument();

    // 전체를 누르면 풀린다
    fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "전체" }));
    fireEvent.click(within(screen.getByRole("group", { name: "추천" })).getByRole("button", { name: "전체" }));
    expect(await screen.findByRole("heading", { name: /5\.8\s*2개/ })).toBeInTheDocument();
  });
});
