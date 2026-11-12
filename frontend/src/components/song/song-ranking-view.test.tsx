import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongRankingView } from "@/components/song/SongRankingView";
import type { SongDetailResponse } from "@/lib/api-types";
import type { SongRankingItem, SongRankingResponse } from "@/lib/song-ranking";

// 전체 순위 화면(D74 구현 PR 3번): 목록·내 줄 강조·쪽 이동·상태별 안내. 서버(곡 정보, 순위)는 fetch 가짜로 대신한다.
const SONG = 5;
const CHART = 12;

const song: SongDetailResponse = {
  id: SONG,
  title: "Test Song",
  artist: "Artist",
  addedVersion: null,
  titleFolder: null,
  bpmMin: null,
  bpmMax: null,
  source: null,
  titles: [],
  difficulties: [{ id: CHART, instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9.5, noteCount: null }] as SongDetailResponse["difficulties"],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function item(over: Partial<SongRankingItem> & { rank: number; userId: number }): SongRankingItem {
  return { nickname: `nick${over.userId}`, achievementRate: 90, stage: "S", isMe: false, ...over };
}

function response(over: Partial<SongRankingResponse> = {}): SongRankingResponse {
  return {
    songDifficultyId: CHART,
    players: 45,
    page: 0,
    size: 20,
    totalPages: 3,
    me: { inRanking: true, rank: 30, achievementRate: 85.5, stage: "S" },
    items: [
      item({ rank: 1, userId: 45, achievementRate: 100, stage: "EXC" }),
      item({ rank: 2, userId: 46, achievementRate: 98.5, stage: "SS" }),
      item({ rank: 3, userId: 47, achievementRate: 96.25, stage: "FC", isMe: false }),
    ],
    ...over,
  };
}

describe("SongRankingView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onPageChange = vi.fn<(page: number) => void>();

  /** 곡 정보와 순위를 주소별로 돌려준다. 순위 요청은 호출 때마다 만든 응답(factory)으로 답한다. */
  function serve(ranking: (url: URL) => Response) {
    fetchMock.mockImplementation((input) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname.endsWith(`/difficulties/${CHART}/ranking`)) return Promise.resolve(ranking(url));
      if (url.pathname.endsWith(`/songs/${SONG}`)) return Promise.resolve(json(song));
      return Promise.resolve(json({}, 404));
    });
  }

  beforeEach(() => {
    fetchMock.mockReset();
    onPageChange.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderView(props: { page?: number; chartId?: number | null } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <SongRankingView songId={SONG} chartId={props.chartId === undefined ? CHART : props.chartId} userId={1} page={props.page ?? 0} onPageChange={onPageChange} />
      </QueryClientProvider>,
    );
  }

  const rankingCalls = () => fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.includes("/ranking"));

  it("곡 정보 헤더와 순위 목록이 보이고, 줄마다 순위·닉네임 링크·달성률(MAX/둘째 자리)·단계 글자가 있다", async () => {
    serve(() => json(response()));
    renderView();

    expect(await screen.findByText("Test Song")).toBeInTheDocument();
    expect(await screen.findByText("내 순위 30위 / 기록한 공개 유저 45명")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("1위")).toBeInTheDocument();
    expect(within(rows[0]).getByText("MAX")).toBeInTheDocument();
    expect(within(rows[0]).getByText("EXC")).toBeInTheDocument();
    expect(within(rows[1]).getByText("98.50%")).toBeInTheDocument();
    expect(within(rows[1]).getByText("SS")).toBeInTheDocument();
    expect(within(rows[2]).getByText("FC")).toBeInTheDocument();
    expect(within(rows[2]).getByRole("link", { name: "nick47" })).toHaveAttribute("href", "/players/47");
  });

  it("쪽 크기 20으로 지금 쪽(page)을 요청한다", async () => {
    serve(() => json(response({ page: 2 })));
    renderView({ page: 2 });
    await screen.findByText("Test Song");
    await waitFor(() => expect(rankingCalls()).toHaveLength(1));

    const url = rankingCalls()[0];
    expect(url).toContain(`/difficulties/${CHART}/ranking`);
    expect(url).toContain("page=2");
    expect(url).toContain("size=20");
  });

  it("내 줄은 `나` 글자와 aria-current로 강조한다(색만으로 구분하지 않는다)", async () => {
    serve(() => json(response({ items: [item({ rank: 1, userId: 45 }), item({ rank: 2, userId: 1, isMe: true, nickname: "me!" })] })));
    renderView();

    const mine = (await screen.findByRole("link", { name: "me!" })).closest("li");
    expect(mine).toHaveAttribute("aria-current", "true");
    expect(within(mine as HTMLElement).getByText("나")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).not.toHaveAttribute("aria-current");
  });

  it("다음/이전 버튼은 쪽을 바꾸는 콜백을 부르고, 첫 쪽에서는 `이전`이 막혀 있다", async () => {
    serve(() => json(response()));
    renderView({ page: 0 });
    await screen.findByText("Test Song");
    await screen.findAllByRole("listitem");

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("내 순위가 이 쪽에 없으면 `내 순위로 이동`으로 내 순위가 있는 쪽(0부터)으로 간다", async () => {
    serve(() => json(response())); // 내 순위 30위, 쪽 크기 20 -> 둘째 쪽(1)
    renderView({ page: 0 });
    await screen.findAllByRole("listitem");

    fireEvent.click(screen.getByRole("button", { name: "내 순위로 이동" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("쪽을 넘기는 동안 이전 쪽 목록을 그대로 두고, 새 쪽이 오면 바꾼다(깜빡임 없음)", async () => {
    let resolveSecond: (r: Response) => void = () => undefined;
    // 둘째 쪽 요청은 보류해 두었다가 직접 응답한다
    fetchMock.mockImplementation((input) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname.endsWith(`/songs/${SONG}`)) return Promise.resolve(json(song));
      if (url.searchParams.get("page") === "1") return new Promise<Response>((resolve) => (resolveSecond = resolve));
      return Promise.resolve(json(response()));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (page: number) => (
      <QueryClientProvider client={client}>
        <SongRankingView songId={SONG} chartId={CHART} userId={1} page={page} onPageChange={onPageChange} />
      </QueryClientProvider>
    );
    const { rerender } = render(view(0));
    await screen.findByText("nick45");

    rerender(view(1));
    // 둘째 쪽 응답 전에도 첫 쪽 목록이 남아 있다
    expect(screen.getByText("nick45")).toBeInTheDocument();
    resolveSecond(json(response({ page: 1, items: [item({ rank: 21, userId: 99 })] })));
    expect(await screen.findByText("nick99")).toBeInTheDocument();
    expect(screen.queryByText("nick45")).not.toBeInTheDocument();
  });

  it("범위를 벗어난 쪽(빈 목록)은 안내와 `첫 쪽으로` 버튼을 보인다", async () => {
    serve(() => json(response({ page: 9, items: [] })));
    renderView({ page: 9 });

    expect(await screen.findByText("이 쪽에는 표시할 순위가 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "첫 쪽으로" }));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("공개 유저가 0명이면 빈 상태 안내만 보인다(쪽 이동 없음)", async () => {
    serve(() => json(response({ players: 0, totalPages: 0, me: null, items: [] })));
    renderView();

    expect(await screen.findByText("아직 순위에 오른 기록이 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "페이지 이동" })).not.toBeInTheDocument();
  });

  it("인원이 1명이어도 순위를 보인다", async () => {
    serve(() => json(response({ players: 1, totalPages: 1, me: null, items: [item({ rank: 1, userId: 45 })] })));
    renderView();

    expect(await screen.findByText("nick45")).toBeInTheDocument();
    expect(screen.getByText("기록한 공개 유저 1명")).toBeInTheDocument();
  });

  it("내가 비공개이면 목록은 보이고 내 줄 대신 공개 안내와 설정 링크가 보인다", async () => {
    serve(() => json(response({ me: { inRanking: false } })));
    renderView();

    expect(await screen.findByText("nick45")).toBeInTheDocument();
    expect(screen.getByText(/공개로 바꾸면 순위에 참여할 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "공개 설정" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("button", { name: "내 순위로 이동" })).not.toBeInTheDocument();
  });

  it("공개인데 이 채보에 기록이 없으면 안내 한 줄이 보인다", async () => {
    serve(() => json(response({ me: null })));
    renderView();

    expect(await screen.findByText("이 채보의 내 기록이 아직 없어요")).toBeInTheDocument();
  });

  it("순위를 불러오지 못하면 안내와 `다시 시도`가 보이고, 다시 시도하면 목록이 나온다", async () => {
    serve(() => json({ message: "x" }, 500));
    renderView();
    expect(await screen.findByText(/순위를 불러오지 못했습니다/)).toBeInTheDocument();

    serve(() => json(response()));
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("nick45")).toBeInTheDocument();
  });

  it("곡이 없으면(404) 곡을 찾을 수 없다고 안내하고 순위를 부르지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ message: "no" }, 404));
    renderView();

    expect(await screen.findByText("곡을 찾을 수 없습니다.")).toBeInTheDocument();
    expect(rankingCalls()).toHaveLength(0);
  });

  it("닉네임은 글자로만 그리고(HTML 해석 없음), 이메일·역할은 화면에 없다", async () => {
    serve(() => json(response({ items: [item({ rank: 1, userId: 45, nickname: "<b>x</b>" })] })));
    const { container } = renderView();

    expect(await screen.findByText("<b>x</b>")).toBeInTheDocument();
    expect(container.querySelector("li b")).toBeNull();
    expect(container.textContent).not.toMatch(/@|ROOT|ADMIN/);
  });

  it("chart가 없으면 곡 상세와 같이 가장 레벨이 높은 채보로 순위를 부른다", async () => {
    serve(() => json(response()));
    renderView({ chartId: null });
    await screen.findByText("nick45");

    expect(rankingCalls()[0]).toContain(`/difficulties/${CHART}/ranking`);
  });
});
