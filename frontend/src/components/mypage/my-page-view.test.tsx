import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyPageView } from "@/components/mypage/MyPageView";
import type { ChartFolderListResponse, SkillResponse } from "@/lib/api-types";
import type { MyPageTab } from "@/lib/my-page";

const skill = {
  noteOption: "SUPER_RANDOM_PLUS",
  totalScore: 10,
  singleScore: 5,
  otherScore: 5,
  tier: { key: "WHITE", displayName: "White", minScore: 0, nextMinScore: 500, nextDisplayName: "Gray" },
  singleLimit: 15,
  otherLimit: 25,
  single: [],
  other: [],
} as unknown as SkillResponse;

const folders: ChartFolderListResponse = {
  totalSongs: 1,
  totalCharts: 20,
  versions: [],
  folders: [
    { lo: 9, hi: 9.5, total: 20, recorded: 10, exc: 1, fc: 2, ss: 3, s: 2, belowS: 2, averageRecorded: null, averageWithZero: 0, subFolders: [] },
  ],
};

describe("MyPageView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }
  function renderView(tab: MyPageTab, onTabChange = vi.fn()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MyPageView userId={1} tab={tab} onTabChange={onTabChange} />
      </QueryClientProvider>,
    );
    return onTabChange;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/songs/chart-folders")) return Promise.resolve(json(folders));
      if (url.includes("/skills/me/snapshots/status")) return Promise.resolve(json({ canSave: true, reason: null }));
      if (url.includes("/skills/me/snapshots")) return Promise.resolve(json({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }));
      if (url.includes("/skills/me")) return Promise.resolve(json(skill));
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("제목, 전체 달성 현황(합산한 단계별 개수), 레이팅·통계 탭을 보여 준다", async () => {
    renderView("rating");
    expect(screen.getByRole("heading", { level: 1, name: "마이페이지" })).toBeInTheDocument();

    const overall = await screen.findByRole("region", { name: "전체 달성 현황" });
    expect(overall).toHaveTextContent("기록 10/20");
    expect(within(overall).getByText("EXC").closest("li")).toHaveTextContent("1");
    expect(within(overall).getByText("FC").closest("li")).toHaveTextContent("2");
    expect(overall).toHaveTextContent("S 미만 2");

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["레이팅", "통계"]);
    expect(screen.getByRole("tab", { name: "레이팅" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "통계" })).toHaveAttribute("aria-selected", "false");
  });

  it("레이팅 탭이 선택돼 있으면 내 레이팅을 보여 준다", async () => {
    renderView("rating");
    expect(await screen.findByRole("region", { name: "내 레이팅" })).toBeInTheDocument();
  });

  it("통계 탭이 선택돼 있으면 통계 내용을 보여 주고 레이팅 요약은 그리지 않는다", async () => {
    renderView("stats");
    expect(await screen.findByRole("region", { name: "전체 달성 현황" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "통계" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("region", { name: "내 레이팅" })).toBeNull();
  });

  it("탭을 누르면 바꿔 달라고 부모에게 알린다", async () => {
    const onTabChange = renderView("rating");
    fireEvent.click(screen.getByRole("tab", { name: "통계" }));
    expect(onTabChange).toHaveBeenCalledWith("stats");
  });

  it("달성 현황을 못 받아도 탭과 레이팅은 그대로 쓴다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/skills/me/snapshots")) return Promise.resolve(json({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }));
      return Promise.resolve(url.includes("/skills/me") ? json(skill) : json({ code: "ERR", message: "x" }, 500));
    });
    renderView("rating");
    expect(await screen.findByText("달성 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "내 레이팅" })).toBeInTheDocument();
  });
});
