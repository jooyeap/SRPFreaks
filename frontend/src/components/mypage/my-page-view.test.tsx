import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyPageView } from "@/components/mypage/MyPageView";
import type { ChartFolderListResponse, RateFolderListResponse, SkillResponse } from "@/lib/api-types";
import type { MyPageState } from "@/lib/my-page";

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

const rateFolders: RateFolderListResponse = {
  folders: [
    {
      key: 9.5,
      total: 10,
      recorded: 6,
      buckets: [
        { bucket: "R95", count: 3, exc: 1, fc: 1 },
        { bucket: "R90", count: 1, exc: 0, fc: 0 },
        { bucket: "R85", count: 0, exc: 0, fc: 0 },
        { bucket: "R80", count: 1, exc: 0, fc: 0 },
        { bucket: "R73", count: 0, exc: 0, fc: 0 },
        { bucket: "BELOW", count: 1, exc: 0, fc: 0 },
        { bucket: "UNPLAYED", count: 4, exc: 0, fc: 0 },
      ],
    },
  ],
};

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
  function renderView(tab: MyPageState["tab"], axis: MyPageState["axis"] = "level", onStateChange = vi.fn()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MyPageView userId={1} state={{ tab, axis }} onStateChange={onStateChange} />
      </QueryClientProvider>,
    );
    return onStateChange;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/stats/level-rate-folders")) return Promise.resolve(json(rateFolders));
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

  it("통계 탭이 선택돼 있으면 레벨 폴더 통계를 보여 주고 레이팅 요약은 그리지 않는다", async () => {
    renderView("stats");
    expect(await screen.findByRole("region", { name: "레벨 9.50 ~ 9.99" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "통계" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "레벨 폴더" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("region", { name: "내 레이팅" })).toBeNull();
  });

  it("폴더를 펼치면 달성률 구간 7개와 95~100 구간의 MAX·FC 뱃지가 보이고, 구간은 목록 화면으로 가는 링크다", async () => {
    renderView("stats");
    const card = await screen.findByRole("region", { name: "레벨 9.50 ~ 9.99" });
    expect(card).toHaveTextContent("기록 6/10");
    fireEvent.click(within(card).getByRole("button", { name: /9\.50 ~ 9\.99/ }));

    const list = within(card).getByRole("list", { name: "9.50 ~ 9.99 달성률 구간" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent("95 ~ 100%");
    expect(rows[0]).toHaveTextContent("MAX 1");
    expect(rows[0]).toHaveTextContent("FC 1");
    expect(rows[1]).not.toHaveTextContent("MAX");
    expect(rows[6]).toHaveTextContent("미플레이");
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "/me/folder?axis=level&key=9.50&bucket=R95");
  });

  it("서열표 난이도 기준을 누르면 바꿔 달라고 알린다", async () => {
    const onStateChange = renderView("stats");
    fireEvent.click(await screen.findByRole("tab", { name: "서열표 난이도" }));
    expect(onStateChange).toHaveBeenCalledWith({ tab: "stats", axis: "tier" });
  });

  it("서열표 난이도 기준이면 서열표를 찾아 난이도별 통계를 보여 준다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/difficulty-tables")) {
        return Promise.resolve(json([{ id: 3, name: "SRN+ 서열표", instrumentPart: "GUITAR", noteOption: "SUPER_RANDOM_PLUS", status: "ACTIVE", revision: 1 }]));
      }
      if (url.includes("/stats/tier-rate-folders")) {
        expect(url).toContain("tableId=3");
        return Promise.resolve(json({ folders: [{ ...rateFolders.folders[0], key: 5.8 }] }));
      }
      if (url.includes("/songs/chart-folders")) return Promise.resolve(json(folders));
      return Promise.resolve(json({}, 404));
    });
    renderView("stats", "tier");
    expect(await screen.findByRole("region", { name: "레이팅 상수 난이도 5.8" })).toBeInTheDocument();
  });

  it("모든 채보를 같은 단계 이상으로 달성한 폴더는 그 단계로 밝아지고 글자도 같이 보인다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/stats/level-rate-folders")) {
        return Promise.resolve(json({ folders: [{ key: 8, total: 4, recorded: 4, buckets: [
          { bucket: "R95", count: 4, exc: 1, fc: 0 }, { bucket: "R90", count: 0, exc: 0, fc: 0 }, { bucket: "R85", count: 0, exc: 0, fc: 0 },
          { bucket: "R80", count: 0, exc: 0, fc: 0 }, { bucket: "R73", count: 0, exc: 0, fc: 0 }, { bucket: "BELOW", count: 0, exc: 0, fc: 0 },
          { bucket: "UNPLAYED", count: 0, exc: 0, fc: 0 },
        ] }] }));
      }
      if (url.includes("/songs/chart-folders")) return Promise.resolve(json(folders));
      return Promise.resolve(json({}, 404));
    });
    renderView("stats");
    const card = await screen.findByRole("region", { name: "레벨 8.00 ~ 8.49" });
    expect(within(card).getByRole("button")).toHaveAttribute("data-stage", "SS"); // EXC 1 + 나머지 SS 3 -> 모두 SS 이상
    expect(card).toHaveTextContent("전부 SS 이상");
  });

  it("탭을 누르면 바꿔 달라고 부모에게 알린다", async () => {
    const onStateChange = renderView("rating");
    fireEvent.click(screen.getByRole("tab", { name: "통계" }));
    expect(onStateChange).toHaveBeenCalledWith({ tab: "stats", axis: "level" });
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
