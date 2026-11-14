import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartStatsView } from "@/components/admin/ChartStatsView";
import type { ChartStatsMeta, DeviationRow, FolderRow, PopularityRow, StatsChart, UndecidedRow } from "@/lib/chart-stats";

const META: ChartStatsMeta = { publicUsers: 12, minPlayers: 3, minFolderCharts: 3, recentDays: 7 };

function chart(id: number, title: string, tier: number | null = 6.0): StatsChart {
  return { songDifficultyId: id, songId: 100 + id, title, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier };
}

function page<T>(content: T[], over: Partial<{ page: number; totalPages: number }> = {}) {
  return { content, page: over.page ?? 0, size: 20, totalElements: content.length, totalPages: over.totalPages ?? 1, meta: META };
}

const DEVIATION: DeviationRow[] = [
  { chart: chart(4, "곡 넷"), players: 3, records: 6, avgRate: 70, folderAvgRate: 88.33, deviation: -18.33, folderSampleCharts: 3 },
  { chart: chart(1, "곡 하나"), players: 3, records: 5, avgRate: 95, folderAvgRate: 80, deviation: 15, folderSampleCharts: 3 },
  { chart: chart(5, "곡 다섯"), players: 2, records: 20, avgRate: null, folderAvgRate: 83.75, deviation: null, folderSampleCharts: 4 },
  { chart: chart(6, "곡 여섯", 7.0), players: 3, records: 4, avgRate: 88, folderAvgRate: null, deviation: null, folderSampleCharts: 0 },
];

const POPULARITY: PopularityRow[] = [
  { chart: chart(5, "곡 다섯"), records: 20, players: 2, recentRecords: 4 },
  { chart: chart(2, "곡 둘"), records: 9, players: 3, recentRecords: 0 },
];

const FOLDERS: FolderRow[] = [
  { tier: 5.8, chartCount: 4, sampledCharts: 3, avgRate: 80, deltaFromPrevious: null },
  { tier: 5.9, chartCount: 5, sampledCharts: 1, avgRate: null, deltaFromPrevious: null },
  { tier: 6.0, chartCount: 6, sampledCharts: 3, avgRate: 70, deltaFromPrevious: -10 },
];

const UNDECIDED: UndecidedRow[] = [{ chart: chart(9, "곡 아홉", null), records: 11, players: 4 }];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ChartStatsView (서열표 분석)", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/admin/chart-stats/deviation")) return Promise.resolve(json(page(DEVIATION)));
      if (url.includes("/admin/chart-stats/popularity")) return Promise.resolve(json(page(POPULARITY)));
      if (url.includes("/admin/chart-stats/folders")) return Promise.resolve(json(page(FOLDERS)));
      if (url.includes("/admin/chart-stats/undecided")) return Promise.resolve(json(page(UNDECIDED)));
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderView() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ChartStatsView viewerId={1} />
      </QueryClientProvider>,
    );
  }

  function urls(): string[] {
    return fetchMock.mock.calls.map((call) => String(call[0]));
  }

  it("편차 탭은 곡마다 평균·폴더 평균·편차를 부호가 있는 숫자로 보여 준다", async () => {
    renderView();

    const list = await screen.findByRole("list", { name: "곡 목록" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("곡 넷");
    expect(rows[0]).toHaveTextContent("70.00%");
    expect(rows[0]).toHaveTextContent("88.33%");
    expect(rows[0]).toHaveTextContent("−18.33%p");
    expect(rows[1]).toHaveTextContent("+15.00%p");
    expect(rows[0]).toHaveTextContent("Guitar | MAS 9.50 · 6.0");
  });

  it("플레이어 3명 미만은 표본 부족, 폴더 비교가 부족하면 폴더 표본 부족이라고 보여 준다", async () => {
    renderView();

    const list = await screen.findByRole("list", { name: "곡 목록" });
    const rows = within(list).getAllByRole("listitem");
    // 곡 다섯: 플레이어 2명 → 평균 표본 부족(편차 없음)
    expect(rows[2]).toHaveTextContent("표본 부족");
    expect(rows[2]).toHaveTextContent("2명");
    expect(rows[2]).toHaveTextContent("–");
    // 곡 여섯: 평균은 있는데 폴더 평균이 없음
    expect(rows[3]).toHaveTextContent("88.00%");
    expect(rows[3]).toHaveTextContent("폴더 표본 부족");
  });

  it("곡 이름을 누르면 유저별 상세로 가고, 머리에 집계 기준(공개 프로필 N명)이 보인다", async () => {
    renderView();

    const link = await screen.findByRole("link", { name: "곡 넷 유저별 상세 보기" });
    expect(link).toHaveAttribute("href", "/admin/chart-stats/4");
    expect(await screen.findByText("공개 프로필 12명의 기록을 곡별로 집계한 숫자입니다. 판정은 관리자가 합니다.")).toBeInTheDocument();
  });

  it("정렬 칩을 누르면 그 정렬로 서버에 다시 묻는다", async () => {
    renderView();
    await screen.findByRole("list", { name: "곡 목록" });
    expect(urls().some((u) => u.includes("/deviation") && u.includes("sort=deviation"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "평균 높은 순" }));
    await waitFor(() => expect(urls().some((u) => u.includes("/deviation") && u.includes("sort=avg") && u.includes("page=0"))).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "플레이어 순" }));
    await waitFor(() => expect(urls().some((u) => u.includes("sort=players"))).toBe(true));
    expect(screen.getByRole("button", { name: "플레이어 순" })).toHaveAttribute("aria-pressed", "true");
  });

  it("인기 탭: 기록 건수·플레이어 수·최근 7일 증가분이 나오고 기간을 바꿀 수 있다", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("tab", { name: "인기" }));

    const list = await screen.findByRole("list", { name: "곡 목록" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("곡 다섯");
    expect(rows[0]).toHaveTextContent("20건");
    expect(rows[0]).toHaveTextContent("2명");
    expect(rows[0]).toHaveTextContent("+4건");

    fireEvent.click(screen.getByRole("button", { name: "최근 7일" }));
    await waitFor(() => expect(urls().some((u) => u.includes("/popularity") && u.includes("range=7d"))).toBe(true));
  });

  it("폴더 곡선 탭: 점은 표본 충분 폴더에만 있고 점을 누르면 값이 글자로 나온다", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("tab", { name: "폴더 곡선" }));

    const graph = await screen.findByRole("img", { name: "폴더별 평균 달성률 그래프" });
    // 5.9 폴더는 표본 부족이라 점이 없다(선이 건너뛴다)
    expect(graph.querySelectorAll("[data-point]")).toHaveLength(2);
    expect(graph.querySelector('[data-point="5.9"]')).toBeNull();

    const point = screen.getByRole("button", { name: "6.0 폴더 평균 70.00%" });
    fireEvent.click(point);
    expect(screen.getByRole("status")).toHaveTextContent("6.0 폴더 · 평균 70.00% · 6곡(표본 3곡)");
    expect(point).toHaveAttribute("aria-pressed", "true");
    // 다시 누르면 선택이 풀린다
    fireEvent.click(point);
    expect(screen.getByRole("status")).toHaveTextContent("점을 누르면 값이 표시됩니다.");

    // 목록: 표본 부족 폴더, 이전 폴더 대비 증감(부호)
    const list = screen.getByRole("list", { name: "곡 목록" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("폴더 표본 부족");
    expect(rows[2]).toHaveTextContent("−10.00%p");
  });

  it("키보드(Enter)로도 점을 선택할 수 있다", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("tab", { name: "폴더 곡선" }));

    const point = await screen.findByRole("button", { name: "5.8 폴더 평균 80.00%" });
    fireEvent.keyDown(point, { key: "Enter" });

    expect(screen.getByRole("status")).toHaveTextContent("5.8 폴더 · 평균 80.00%");
  });

  it("미정 탭: 기준 난이도가 없는 곡과 기록 건수·플레이어 수", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("tab", { name: "미정" }));

    const list = await screen.findByRole("list", { name: "곡 목록" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("곡 아홉");
    expect(rows[0]).toHaveTextContent("미정");
    expect(rows[0]).toHaveTextContent("11건");
    expect(rows[0]).toHaveTextContent("4명");
  });

  it("「?」를 누르면 집계 기준이 서버가 준 기준 숫자로 보인다", async () => {
    renderView();
    await screen.findByRole("list", { name: "곡 목록" });

    fireEvent.click(screen.getByRole("button", { name: "집계 기준 설명 보기" }));

    expect(await screen.findByText(/플레이어가 3명 미만인 곡은 평균을 숨기고/)).toBeInTheDocument();
    expect(screen.getByText(/비교할 곡이 3곡 미만이면 숨깁니다/)).toBeInTheDocument();
  });

  it("어느 탭에도 판정·경고 말이 없다(숫자와 +/− 부호뿐)", async () => {
    renderView();
    const JUDGMENT = /(후보|역전|적정|경고|쉬운|쉬움|어려운|어려움|너무)/;
    await screen.findByRole("list", { name: "곡 목록" });
    expect(document.body.textContent).not.toMatch(JUDGMENT);

    for (const name of ["인기", "폴더 곡선", "미정"]) {
      fireEvent.click(screen.getByRole("tab", { name }));
      await screen.findByRole("tabpanel");
      await waitFor(() => expect(screen.queryByText("서열표 분석을 불러오는 중입니다.")).toBeNull());
      expect(document.body.textContent, name).not.toMatch(JUDGMENT);
    }
  });

  it("조회가 실패하면 안내와 다시 시도가 보인다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/deviation") ? json({ code: "INTERNAL_ERROR", message: "x" }, 500) : json(page(FOLDERS))),
    );
    renderView();

    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("탭 네 개: 편차 / 인기 / 폴더 곡선 / 미정", async () => {
    renderView();
    const tabs = within(await screen.findByRole("tablist", { name: "서열표 분석 구분" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["편차", "인기", "폴더 곡선", "미정"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });
});
