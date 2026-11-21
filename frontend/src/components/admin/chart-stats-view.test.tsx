import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartStatsView } from "@/components/admin/ChartStatsView";
import type { ChartStatsMeta, DeviationRow, FolderDistributionPage, PopularityRow, StatsChart, UndecidedRow } from "@/lib/chart-stats";

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

const DIST_USERS: FolderDistributionPage["users"] = [
  { userId: 1, nickname: "알파", tier: { key: "RED", displayName: "Red", minScore: 6000, nextDisplayName: null, nextMinScore: null }, totalScore: 6100 },
  { userId: 2, nickname: "베타", tier: { key: "GOLD", displayName: "Gold", minScore: 8000, nextDisplayName: null, nextMinScore: null }, totalScore: 8100 },
  { userId: 3, nickname: "감마", tier: { key: "IRIDESCENT", displayName: "Iridescent", minScore: 9500, nextDisplayName: null, nextMinScore: null }, totalScore: 9600 },
  { userId: 4, nickname: "델타", tier: { key: "BRONZE", displayName: "Bronze", minScore: 7000, nextDisplayName: null, nextMinScore: null }, totalScore: 7100 },
];

/** 5.8 폴더 유저 4명(점 4개), 5.9 폴더 유저 2명(표본 부족), 6.0 폴더 유저 3명(점 3개) */
const DIST: FolderDistributionPage = {
  content: [
    {
      tier: 5.8,
      cells: [
        { userId: 1, charts: 2, sumRate: 160 },
        { userId: 2, charts: 1, sumRate: 90 },
        { userId: 3, charts: 1, sumRate: 70 },
        { userId: 4, charts: 4, sumRate: 340 },
      ],
    },
    {
      tier: 5.9,
      cells: [
        { userId: 1, charts: 1, sumRate: 50 },
        { userId: 2, charts: 1, sumRate: 60 },
      ],
    },
    {
      tier: 6.0,
      cells: [
        { userId: 1, charts: 1, sumRate: 70 },
        { userId: 2, charts: 1, sumRate: 80 },
        { userId: 3, charts: 1, sumRate: 90 },
      ],
    },
  ],
  page: 0,
  size: 100,
  totalElements: 3,
  totalPages: 1,
  users: DIST_USERS,
  meta: META,
};

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
      if (url.includes("/admin/chart-stats/folder-distribution")) return Promise.resolve(json(DIST));
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

  async function openDistribution() {
    renderView();
    fireEvent.click(await screen.findByRole("tab", { name: "폴더 분포" }));
    // 유닛은 0.1 단위로 맞춰 폴더를 그대로 본다(기본 단위는 화면 폭에 따라 다르다)
    fireEvent.click(await screen.findByRole("button", { name: "0.1 단위" }));
    return screen.findByRole("group", { name: "폴더별 유저 평균 달성률 점 도표" });
  }

  it("폴더 분포 탭: 유저 3명 이상인 폴더에만 점이 있고 3명 미만은 표본 부족이다", async () => {
    const plot = await openDistribution();

    // 5.8 폴더 4개 + 6.0 폴더 3개. 5.9 폴더는 유저가 2명이라 점이 없다
    expect(plot.querySelectorAll("[data-dot]")).toHaveLength(7);
    expect(plot.querySelector('[data-insufficient="5.9"]')).not.toBeNull();
    expect(screen.getByText(/표본 부족 폴더\(유저 3명 미만\): 5\.9/)).toBeInTheDocument();
  });

  it("점 색은 유저의 티어 key(data-tier)이고 이름은 글자로도 보인다", async () => {
    const plot = await openDistribution();

    const red = within(plot).getByRole("button", { name: "5.8 폴더 · Red · 평균 80.00%" });
    expect(red).toHaveAttribute("data-tier", "RED");
    expect(within(plot).getByRole("button", { name: "5.8 폴더 · Iridescent · 평균 70.00%" })).toHaveAttribute("data-tier", "IRIDESCENT");
    // 색 값은 컴포넌트에 없다: 점은 chart-dot 클래스로 CSS 변수를 쓴다
    expect(red.querySelector("span")?.className).toContain("chart-dot");
    // 범례에도 티어 이름이 글자로 있다
    expect(within(screen.getByRole("list", { name: "티어 색 범례" })).getByText("Iridescent")).toBeInTheDocument();
  });

  it("점을 누르면 말풍선에 닉네임·티어·평균 달성률·곡 수가 나오고 누르기 전에는 닉네임이 없다", async () => {
    const plot = await openDistribution();
    expect(document.body.textContent).not.toContain("알파");

    const point = within(plot).getByRole("button", { name: "5.8 폴더 · Red · 평균 80.00%" });
    fireEvent.click(point);

    const bubble = plot.querySelector("[data-bubble]") as HTMLElement;
    expect(bubble).not.toBeNull();
    expect(bubble).toHaveTextContent("Red");
    expect(bubble).toHaveTextContent("알파");
    expect(bubble).toHaveTextContent("평균 80.00% · 2곡 · 폴더 5.8");
    expect(within(bubble).getByRole("link", { name: "유저 상세 ›" })).toHaveAttribute("href", "/players/1");
    expect(point).toHaveAttribute("aria-pressed", "true");
    // 다시 누르면 닫힌다
    fireEvent.click(point);
    expect(plot.querySelector("[data-bubble]")).toBeNull();
  });

  it("티어 강조 칩은 그 티어군이 아닌 점을 흐리게 한다", async () => {
    const plot = await openDistribution();
    expect(plot.querySelectorAll("[data-dimmed]")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "~Red Gradient" }));

    // Red(5.8·6.0 폴더 각 1개)만 진하게, 나머지는 흐리게
    const dimmed = plot.querySelectorAll("[data-dimmed]");
    expect(dimmed).toHaveLength(7 - 2);
    expect(plot.querySelector('[data-tier="RED"]')).not.toHaveAttribute("data-dimmed");
    expect(plot.querySelector('[data-tier="IRIDESCENT"]')).toHaveAttribute("data-dimmed");
  });

  it("0.5 단위로 바꾸면 0.1 폴더의 칸이 합쳐져 채보 수 가중 평균이 된다", async () => {
    const plot = await openDistribution();

    fireEvent.click(screen.getByRole("button", { name: "0.5 단위" }));

    // 5.8 + 5.9 폴더 → 5.5~5.9 묶음. 알파는 3곡 합 210 → 70.00%
    expect(within(plot).getByRole("button", { name: "5.5~5.9 폴더 · Red · 평균 70.00%" })).toBeInTheDocument();
  });

  it("표로 보기: 같은 값이 표로 나오고 표본 부족 폴더가 표시되며 닉네임은 없다", async () => {
    await openDistribution();

    fireEvent.click(screen.getByRole("button", { name: "표로 보기" }));

    const table = await screen.findByRole("table", { name: "폴더별 유저 평균 달성률 표" });
    expect(within(table).getAllByRole("row").filter((row) => row.hasAttribute("data-row-folder"))).toHaveLength(4 + 1 + 3);
    expect(table).toHaveTextContent("표본 부족 (유저 2명)");
    expect(table).toHaveTextContent("85.00%");
    expect(document.body.textContent).not.toContain("알파");
    // 도표로 돌아간다
    fireEvent.click(screen.getByRole("button", { name: "점 도표" }));
    expect(screen.getByRole("group", { name: "폴더별 유저 평균 달성률 점 도표" })).toBeInTheDocument();
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

    for (const name of ["인기", "폴더 분포", "미정"]) {
      fireEvent.click(screen.getByRole("tab", { name }));
      await screen.findByRole("tabpanel");
      await waitFor(() => expect(screen.queryByText("서열표 분석을 불러오는 중입니다.")).toBeNull());
      expect(document.body.textContent, name).not.toMatch(JUDGMENT);
    }
  });

  it("조회가 실패하면 안내와 다시 시도가 보인다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/deviation") ? json({ code: "INTERNAL_ERROR", message: "x" }, 500) : json(DIST)),
    );
    renderView();

    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("탭 네 개: 편차 / 인기 / 폴더 분포 / 미정", async () => {
    renderView();
    const tabs = within(await screen.findByRole("tablist", { name: "서열표 분석 구분" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["편차", "인기", "폴더 분포", "미정"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });
});
