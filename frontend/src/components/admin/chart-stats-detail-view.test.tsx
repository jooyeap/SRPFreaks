import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartStatsDetailView } from "@/components/admin/ChartStatsDetailView";
import { ChartStatsCard } from "@/components/song/ChartStatsCard";
import type { ChartStatsMeta, ChartStatsSummary, StatsPlayerRow } from "@/lib/chart-stats";

const META: ChartStatsMeta = { publicUsers: 12, minPlayers: 3, minFolderCharts: 3, recentDays: 7 };
const CHART = { songDifficultyId: 10, songId: 1, title: "테스트곡", part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 6.0 } as const;

function summary(over: Partial<ChartStatsSummary> = {}): ChartStatsSummary {
  return {
    chart: CHART,
    players: 6,
    records: 14,
    avgRate: 87.12,
    medianRate: 88.5,
    folderAvgRate: 89.47,
    deviation: -2.35,
    folderSampleCharts: 5,
    meta: META,
    ...over,
  };
}

function player(userId: number, over: Partial<StatsPlayerRow> = {}): StatsPlayerRow {
  return {
    userId,
    nickname: `nick${userId}`,
    tier: { key: "gold", displayName: "Gold", minScore: 100, nextDisplayName: null, nextMinScore: null },
    totalScore: 1234.5,
    bestRate: 93.456,
    playCount: 4,
    lastPlayedAt: "2026-11-10T03:00:00Z",
    ...over,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("서열표 분석 · 곡 상세", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let summaryBody: ChartStatsSummary;
  let players: StatsPlayerRow[];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    summaryBody = summary();
    players = [player(11), player(12, { tier: null, bestRate: 100, totalScore: 0 })];
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/summary")) return Promise.resolve(json(summaryBody));
      if (url.includes("/players")) {
        return Promise.resolve(json({ content: players, page: 0, size: 20, totalElements: players.length, totalPages: 1, meta: META }));
      }
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function wrap(node: React.ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  }

  function urls(): string[] {
    return fetchMock.mock.calls.map((call) => String(call[0]));
  }

  it("요약: 인원·기록 수·평균·중앙값·폴더 평균(비교 곡 수)·편차(부호)", async () => {
    wrap(<ChartStatsDetailView viewerId={1} chartId={10} />);

    const card = await screen.findByRole("region", { name: "집계 요약" });
    expect(card).toHaveTextContent("6명");
    expect(card).toHaveTextContent("14건");
    expect(card).toHaveTextContent("87.12%");
    expect(card).toHaveTextContent("88.50%");
    expect(card).toHaveTextContent("89.47% (비교 5곡 기준)");
    expect(card).toHaveTextContent("−2.35%p");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("테스트곡");
    expect(screen.getByText("Guitar | MAS 9.50 · 6.0")).toBeInTheDocument();
  });

  it("플레이어가 3명 미만이면 평균·중앙값이 표본 부족이다", async () => {
    summaryBody = summary({ players: 2, records: 4, avgRate: null, medianRate: null, deviation: null });
    wrap(<ChartStatsDetailView viewerId={1} chartId={10} />);

    const card = await screen.findByRole("region", { name: "집계 요약" });
    expect(card).toHaveTextContent("2명");
    expect(card.textContent?.match(/표본 부족/g)).toHaveLength(2);
  });

  it("폴더 평균을 낼 수 없으면 폴더 표본 부족, 미정 곡이면 미정", async () => {
    summaryBody = summary({ folderAvgRate: null, deviation: null, folderSampleCharts: 0 });
    const { unmount } = wrap(<ChartStatsDetailView viewerId={1} chartId={10} />);
    expect(await screen.findByRole("region", { name: "집계 요약" })).toHaveTextContent("폴더 표본 부족");
    unmount();

    summaryBody = summary({ chart: { ...CHART, tier: null }, folderAvgRate: null, deviation: null, folderSampleCharts: 0 });
    wrap(<ChartStatsDetailView viewerId={1} chartId={10} />);
    expect(await screen.findByText("Guitar | MAS 9.50 · 미정")).toBeInTheDocument();
  });

  it("공개 유저 목록: 닉네임(기존 공개 상세로 가는 링크)·티어·최고 달성률·총점·횟수·마지막 플레이", async () => {
    wrap(<ChartStatsDetailView viewerId={1} chartId={10} />);

    const list = await screen.findByRole("list", { name: "공개 유저별 기록" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link", { name: "nick11 상세 보기" })).toHaveAttribute("href", "/players/11");
    expect(rows[0]).toHaveTextContent("Gold");
    expect(rows[0]).toHaveTextContent("93.46%");
    expect(rows[0]).toHaveTextContent("1234.50");
    expect(rows[0]).toHaveTextContent("4건");
    expect(rows[0]).toHaveTextContent("2026-11-10");
    expect(rows[1]).toHaveTextContent("MAX");
    // 이메일·역할 같은 값은 화면에 없다
    expect(document.body.textContent).not.toMatch(/@|ROOT|ADMIN|google/i);
  });

  it("정렬 칩(달성률/총점/횟수)을 누르면 그 정렬로 다시 묻는다", async () => {
    wrap(<ChartStatsDetailView viewerId={1} chartId={10} />);
    await screen.findByRole("list", { name: "공개 유저별 기록" });
    expect(urls().some((u) => u.includes("/charts/10/players") && u.includes("sort=rate"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "총점 순" }));
    await waitFor(() => expect(urls().some((u) => u.includes("sort=score"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "횟수 순" }));
    await waitFor(() => expect(urls().some((u) => u.includes("sort=plays"))).toBe(true));
  });

  it("공개 유저가 없으면 안내가 보인다", async () => {
    players = [];
    wrap(<ChartStatsDetailView viewerId={1} chartId={10} />);

    expect(await screen.findByText("이 곡을 기록한 공개 유저가 없습니다.")).toBeInTheDocument();
  });

  it("없는 채보(404)면 안내와 다시 시도가 보인다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ code: "NOT_FOUND", message: "찾을 수 없습니다." }, 404)));
    wrap(<ChartStatsDetailView viewerId={1} chartId={10} />);

    expect((await screen.findAllByRole("button", { name: "다시 시도" })).length).toBeGreaterThan(0);
  });
});

describe("플레이어 통계 카드 (곡 상세, ROOT·ADMIN)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let body: ChartStatsSummary;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    body = summary();
    fetchMock.mockImplementation(() => Promise.resolve(json(body)));
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderCard() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ChartStatsCard chartId={10} viewerId={1} />
      </QueryClientProvider>,
    );
  }

  it("인원·평균·폴더 대비(편차)와 유저별 상세 링크를 보여 준다", async () => {
    renderCard();

    const card = await screen.findByRole("region", { name: "플레이어 통계" });
    expect(card).toHaveTextContent("6명");
    expect(card).toHaveTextContent("87.12%");
    expect(card).toHaveTextContent("−2.35%p");
    expect(within(card).getByRole("link", { name: "유저별 상세 보기" })).toHaveAttribute("href", "/admin/chart-stats/10");
  });

  it("플레이어 3명 미만이면 표본 부족", async () => {
    body = summary({ players: 2, avgRate: null, medianRate: null, deviation: null });
    renderCard();

    const card = await screen.findByRole("region", { name: "플레이어 통계" });
    expect(card).toHaveTextContent("2명");
    expect(card.textContent?.match(/표본 부족/g)).toHaveLength(2);
  });

  it("폴더 비교가 부족하면 편차 줄에 폴더 표본 부족", async () => {
    body = summary({ folderAvgRate: null, deviation: null, folderSampleCharts: 0 });
    renderCard();

    expect(await screen.findByRole("region", { name: "플레이어 통계" })).toHaveTextContent("폴더 표본 부족");
  });

  it("불러오는 동안에는 아무것도 그리지 않고, 실패하면 안내와 다시 시도만 보인다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ code: "INTERNAL_ERROR", message: "x" }, 500)));
    renderCard();

    expect(screen.queryByRole("region", { name: "플레이어 통계" })).toBeNull();
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("판정 말이 없다", async () => {
    renderCard();
    const card = await screen.findByRole("region", { name: "플레이어 통계" });

    expect(card.textContent).not.toMatch(/(후보|역전|적정|경고|쉬운|쉬움|어려운|어려움|너무)/);
  });
});
