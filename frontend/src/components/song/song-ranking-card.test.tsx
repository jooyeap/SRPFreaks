import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongRankingCard } from "@/components/song/SongRankingCard";
import type { SongRankingItem, SongRankingResponse } from "@/lib/song-ranking";

const CHART = 12;
const SONG = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function item(over: Partial<SongRankingItem> & { rank: number; userId: number }): SongRankingItem {
  return { nickname: `nick${over.userId}`, achievementRate: 90, stage: "S", isMe: false, ...over };
}

/** 서버가 주는 응답 모양(개별 이메일·역할 필드는 없다) */
function response(over: Partial<SongRankingResponse> = {}): SongRankingResponse {
  return {
    songDifficultyId: CHART,
    players: 18,
    page: 0,
    size: 3,
    totalPages: 6,
    me: { inRanking: true, rank: 7, achievementRate: 85.5, stage: "S" },
    items: [
      item({ rank: 1, userId: 45, achievementRate: 100, stage: "EXC" }),
      item({ rank: 2, userId: 46, achievementRate: 98.5, stage: "SS" }),
      item({ rank: 3, userId: 47, achievementRate: 96.25, stage: "SS" }),
    ],
    ...over,
  };
}

describe("SongRankingCard", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderCard() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <SongRankingCard songId={SONG} chartId={CHART} userId={1} />
      </QueryClientProvider>,
    );
  }

  it("상위 3줄에 순위·닉네임·달성률·단계 글자가 보이고, 닉네임은 유저 상세로 연결된다", async () => {
    fetchMock.mockResolvedValue(json(response()));
    renderCard();

    expect(await screen.findByText("내 순위 7위 / 기록한 공개 유저 18명")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("1위")).toBeInTheDocument();
    expect(within(rows[0]).getByText("MAX")).toBeInTheDocument(); // 100.00은 MAX
    expect(within(rows[0]).getByText("EXC")).toBeInTheDocument(); // 단계는 글자로
    expect(within(rows[1]).getByText("98.50%")).toBeInTheDocument();
    expect(within(rows[1]).getByText("SS")).toBeInTheDocument();
    expect(within(rows[2]).getByRole("link", { name: "nick47" })).toHaveAttribute("href", "/players/47");
  });

  describe("닉네임 티어 색", () => {
    it("티어가 있는 줄은 닉네임에 티어 색 클래스와 data-tier가 붙고, 없는 줄은 기본 글자색이다", async () => {
      fetchMock.mockResolvedValue(json(response({
        items: [
          item({ rank: 1, userId: 45, tier: { key: "GOLD", displayName: "Gold" } }),
          item({ rank: 2, userId: 46, tier: { key: "BRONZE", displayName: "Bronze" } }),
          item({ rank: 3, userId: 47, tier: null }),
        ],
      })));
      renderCard();

      const gold = await screen.findByText("nick45");
      expect(gold).toHaveClass("tier-score");
      expect(gold).toHaveAttribute("data-tier", "GOLD");
      expect(screen.getByText("nick46")).toHaveAttribute("data-tier", "BRONZE");
      const plain = screen.getByText("nick47");
      expect(plain).not.toHaveClass("tier-score");
      expect(plain).not.toHaveAttribute("data-tier");
    });

    it("서버가 아직 tier를 주지 않아도(필드 없음) 기본 글자색으로 깨지지 않는다", async () => {
      fetchMock.mockResolvedValue(json(response()));   // 기본 item()에는 tier가 없다
      renderCard();

      const name = await screen.findByText("nick45");
      expect(name).not.toHaveClass("tier-score");
      expect(name).not.toHaveAttribute("data-tier");
    });

    it("내 줄은 티어 색과 상관없이 배경 강조와 '나' 글자로 구분된다", async () => {
      fetchMock.mockResolvedValue(json(response({
        items: [item({ rank: 1, userId: 1, isMe: true, tier: { key: "RAINBOW", displayName: "Rainbow" } })],
      })));
      renderCard();

      const name = await screen.findByText("nick1");
      expect(name).toHaveClass("tier-score");
      const row = name.closest("li");
      expect(row).toHaveAttribute("data-me", "true");
      expect(row).toHaveAttribute("aria-current", "true");
      expect(within(row as HTMLElement).getByText("나")).toBeInTheDocument();
    });
  });

  it("상위 3개만 요청한다(size=3, 첫 페이지)", async () => {
    fetchMock.mockResolvedValue(json(response()));
    renderCard();
    await screen.findByText("내 순위 7위 / 기록한 공개 유저 18명");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`/difficulties/${CHART}/ranking`);
    expect(url).toContain("size=3");
    expect(url).toContain("page=0");
  });

  it("내가 4위 이하이면 아래에 내 줄을 따로 보인다(글자 `나` + 순위·달성률·단계)", async () => {
    fetchMock.mockResolvedValue(json(response()));
    renderCard();

    const mine = await screen.findByTestId("my-ranking-row");
    expect(within(mine).getByText("7위")).toBeInTheDocument();
    expect(within(mine).getByText("나")).toBeInTheDocument();
    expect(within(mine).getByText("85.50%")).toBeInTheDocument();
    expect(within(mine).getByText("S")).toBeInTheDocument();
  });

  it("내가 상위 3 안이면 그 줄만 강조하고 내 줄을 또 그리지 않는다", async () => {
    fetchMock.mockResolvedValue(
      json(
        response({
          me: { inRanking: true, rank: 2, achievementRate: 98.5, stage: "SS" },
          items: [
            item({ rank: 1, userId: 45, achievementRate: 100, stage: "EXC" }),
            item({ rank: 2, userId: 1, nickname: "me", achievementRate: 98.5, stage: "SS", isMe: true }),
            item({ rank: 3, userId: 47, achievementRate: 96.25, stage: "SS" }),
          ],
        }),
      ),
    );
    renderCard();

    expect(await screen.findByText("내 순위 2위 / 기록한 공개 유저 18명")).toBeInTheDocument();
    expect(screen.queryByTestId("my-ranking-row")).not.toBeInTheDocument();
    const mineRow = screen.getAllByRole("listitem")[1];
    expect(mineRow).toHaveAttribute("aria-current", "true");
    expect(within(mineRow).getByText("나")).toBeInTheDocument(); // 색만이 아니라 글자로도
    expect(screen.getAllByText("나")).toHaveLength(1);
  });

  it("공개 유저가 1명이어도 순위를 보인다(인원 기준 없음)", async () => {
    fetchMock.mockResolvedValue(
      json(response({ players: 1, totalPages: 1, me: null, items: [item({ rank: 1, userId: 45, achievementRate: 70, stage: "B" })] })),
    );
    renderCard();

    expect(await screen.findByText("기록한 공개 유저 1명")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("기록한 공개 유저가 0명이면 빈 상태 안내만 보인다", async () => {
    fetchMock.mockResolvedValue(json(response({ players: 0, totalPages: 0, me: null, items: [] })));
    renderCard();

    expect(await screen.findByText("아직 순위에 오른 기록이 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("공개인데 이 채보 기록이 없으면(me = null) 안내 한 줄과 상위 3을 보인다", async () => {
    fetchMock.mockResolvedValue(json(response({ me: null })));
    renderCard();

    expect(await screen.findByText("이 채보의 내 기록이 아직 없어요")).toBeInTheDocument();
    expect(screen.getByText("기록한 공개 유저 18명")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByTestId("my-ranking-row")).not.toBeInTheDocument();
  });

  it("내가 비공개이면 내 줄 대신 공개 안내와 설정 링크를 보이고, 상위 3은 보인다", async () => {
    fetchMock.mockResolvedValue(json(response({ me: { inRanking: false } })));
    renderCard();

    expect(await screen.findByText(/공개로 바꾸면 순위에 참여할 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "공개 설정" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByTestId("my-ranking-row")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // 비공개인 나의 순위·달성률은 서버가 주지 않으므로 `내 순위` 문장도 없다
    expect(screen.queryByText(/내 순위/)).not.toBeInTheDocument();
  });

  it("닉네임은 글자로만 보인다(HTML로 해석하지 않는다)", async () => {
    fetchMock.mockResolvedValue(json(response({ items: [item({ rank: 1, userId: 45, nickname: "<b>bold</b>" })], players: 1, me: null })));
    renderCard();

    expect(await screen.findByText("<b>bold</b>")).toBeInTheDocument();
    expect(document.querySelector("li b")).toBeNull();
  });

  it("응답에 없는 개인 정보(이메일·역할)는 그리지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ ...response(), items: [{ ...item({ rank: 1, userId: 45 }), email: "a@b.c", role: "ADMIN" }] }));
    renderCard();

    await screen.findByText("nick45");
    expect(screen.queryByText("a@b.c")).not.toBeInTheDocument();
    expect(screen.queryByText("ADMIN")).not.toBeInTheDocument();
  });

  it("불러오는 중에는 아무것도 그리지 않는다", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { container } = renderCard();

    expect(container).toBeEmptyDOMElement();
  });

  it("오류이면 카드 안에 안내와 다시 시도를 보이고, 누르면 다시 부른다", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "x" }, 500));
    renderCard();

    expect(await screen.findByText(/순위를 불러오지 못했습니다/)).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(json(response()));
    screen.getByRole("button", { name: "다시 시도" }).click();
    await waitFor(() => expect(screen.getByText("내 순위 7위 / 기록한 공개 유저 18명")).toBeInTheDocument());
  });

  it("기록한 공개 유저가 있으면 맨 아래에 `전체 순위` 링크가 있고 전체 순위 화면(곡 id·채보 id가 든 주소)으로 간다", async () => {
    fetchMock.mockResolvedValue(json(response()));
    renderCard();
    await screen.findByText("내 순위 7위 / 기록한 공개 유저 18명");

    expect(screen.getByRole("link", { name: "전체 순위" })).toHaveAttribute("href", `/songs/${SONG}/ranking?chart=${CHART}`);
  });

  it("기록한 공개 유저가 0명이면 보여 줄 순위가 없어서 `전체 순위` 링크를 그리지 않는다", async () => {
    fetchMock.mockResolvedValue(json(response({ players: 0, totalPages: 0, me: null, items: [] })));
    renderCard();
    await screen.findByText("아직 순위에 오른 기록이 없어요");

    expect(screen.queryByRole("link", { name: /전체 순위/ })).not.toBeInTheDocument();
  });
});
