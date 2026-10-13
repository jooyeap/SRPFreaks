import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerDetailView } from "@/components/players/PlayerDetailView";
import { PlayerListView } from "@/components/players/PlayerListView";
import type { PageResponse, PlayerDetailResponse, PlayerSummaryResponse, SkillEntryResponse, SkillResponse } from "@/lib/api-types";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const tier = { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" };
function player(userId: number, rank: number, nickname: string, totalScore: number): PlayerSummaryResponse {
  return { userId, rank, nickname, tier, totalScore };
}
function pageOf(content: PlayerSummaryResponse[], over: Partial<PageResponse<PlayerSummaryResponse>> = {}) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1, ...over };
}

function renderWith(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PlayerListView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("순위·닉네임·티어·총점을 보여 주고 줄은 상세로 가는 링크다", async () => {
    fetchMock.mockResolvedValue(json(pageOf([player(7, 1, "あか", 5842.6), player(3, 2, "あお", 120)])));
    renderWith(<PlayerListView viewerId={1} />);

    const list = await screen.findByRole("list", { name: "유저 목록" });
    const rows = within(list).getAllByRole("link");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("href", "/players/7");
    expect(rows[0]).toHaveTextContent("1");
    expect(rows[0]).toHaveTextContent("あか");
    expect(rows[0]).toHaveTextContent("Gold");
    expect(rows[0]).toHaveTextContent("5842.60"); // 총점은 소수 둘째 자리까지
    expect(rows[1]).toHaveAttribute("href", "/players/3");
  });

  it("같은 닉네임이 둘이어도 userId로 구분되는 서로 다른 링크가 된다", async () => {
    fetchMock.mockResolvedValue(json(pageOf([player(1, 1, "たろう", 10), player(2, 2, "たろう", 5)])));
    renderWith(<PlayerListView viewerId={1} />);
    const hrefs = (await screen.findAllByRole("link", { name: /たろう/ })).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/players/1", "/players/2"]);
  });

  it("공개한 유저가 없으면 안내 문구를 보여 준다", async () => {
    fetchMock.mockResolvedValue(json(pageOf([], { totalElements: 0, totalPages: 0 })));
    renderWith(<PlayerListView viewerId={1} />);
    expect(await screen.findByText("아직 공개한 유저가 없습니다.")).toBeInTheDocument();
  });

  it("페이지를 넘기면 다음 페이지를 요청한다", async () => {
    fetchMock.mockImplementation((input) => {
      const page = Number(new URL(String(input), "http://x").searchParams.get("page"));
      return Promise.resolve(json(pageOf([player(page + 1, page * 20 + 1, `유저${page}`.replace("유저", "user"), 1)], { page, totalPages: 2 })));
    });
    renderWith(<PlayerListView viewerId={1} />);
    await screen.findByText("1 / 2");
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
    const urls = fetchMock.mock.calls.map((c) => new URL(String(c[0]), "http://x").searchParams.get("page"));
    expect(urls).toContain("1");
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });

  it("서버 오류는 서버가 준 문구로 알려 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL_ERROR", message: "서버에 문제가 생겼습니다.", timestamp: "t" }, 500));
    renderWith(<PlayerListView viewerId={1} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("서버에 문제가 생겼습니다.");
  });
});

describe("PlayerDetailView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const skill: SkillResponse = {
    noteOption: "SUPER_RANDOM_PLUS",
    totalScore: 123.45,
    singleScore: 100,
    otherScore: 23.45,
    tier: { key: "WHITE", displayName: "White", minScore: 0, nextMinScore: 500, nextDisplayName: "Gray" },
    singleLimit: 15,
    otherLimit: 25,
    single: [],
    other: [],
  };
  const detail: PlayerDetailResponse = { userId: 7, nickname: "あか", skill };

  it("닉네임과 읽기 전용 레이팅을 보여 주고 기록 입력 버튼은 없다", async () => {
    fetchMock.mockResolvedValue(json(detail));
    renderWith(<PlayerDetailView viewerId={1} playerId={7} />);

    expect(await screen.findByRole("heading", { name: /あか님의 레이팅/ })).toBeInTheDocument();
    expect(screen.getByLabelText("플레이어 티어 White")).toBeInTheDocument();
    expect(screen.getByText("123.45")).toBeInTheDocument();
    expect(screen.getByText("레이팅에 들어간 기록이 아직 없습니다.")).toBeInTheDocument(); // 남의 화면이라 서열표 링크는 없다
    expect(screen.queryByRole("link", { name: "서열표" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /기록/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "유저 목록으로" })).toHaveAttribute("href", "/players");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/players/7");
  });

  it("404(비공개·없는 유저)는 `유저를 찾을 수 없습니다.`로 안내한다", async () => {
    fetchMock.mockResolvedValue(json({ code: "NOT_FOUND", message: "찾을 수 없습니다.", timestamp: "t" }, 404));
    renderWith(<PlayerDetailView viewerId={1} playerId={99} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("유저를 찾을 수 없습니다.");
    expect(screen.getByRole("link", { name: "유저 목록으로" })).toBeInTheDocument();
  });

  describe("관리자 기록 삭제 (D29)", () => {
    const entry = {
      rank: 1,
      songDifficultyId: 55,
      songId: 5,
      title: "テスト曲",
      part: "GUITAR",
      difficulty: "MASTER",
      level: 9.8,
      tier: 6.5,
      pattern: "단일",
      achievementRate: 100,
      fullCombo: true,
      stage: "EXC",
      ratingConstant: 17.5,
      value: 17.5,
      score: 350,
    } as SkillEntryResponse;
    const withEntry: PlayerDetailResponse = { userId: 7, nickname: "あか", skill: { ...skill, single: [entry] } };

    it("관리자가 아니면 삭제 버튼이 없다", async () => {
      fetchMock.mockResolvedValue(json(withEntry));
      renderWith(<PlayerDetailView viewerId={1} playerId={7} />);
      await screen.findByText("テスト曲");
      expect(screen.queryByRole("button", { name: /삭제/ })).not.toBeInTheDocument();
    });

    it("삭제를 누르면 확인 상자가 뜨고, 취소하면 요청을 보내지 않는다", async () => {
      fetchMock.mockResolvedValue(json(withEntry));
      renderWith(<PlayerDetailView viewerId={1} playerId={7} canDeleteRecords />);
      fireEvent.click(await screen.findByRole("button", { name: "テスト曲 기록 삭제" }));

      expect(screen.getByRole("alertdialog", { name: "기록 삭제 확인" })).toHaveTextContent("모두 삭제할까요?");
      fireEvent.click(screen.getByRole("button", { name: "취소" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(fetchMock.mock.calls.every((c) => (c[1]?.method ?? "GET") === "GET")).toBe(true);
    });

    it("확인하면 DELETE 요청을 보내고 상세를 다시 받는다", async () => {
      fetchMock.mockImplementation((_input, init) =>
        Promise.resolve(init?.method === "DELETE" ? new Response(null, { status: 204 }) : json(withEntry)),
      );
      renderWith(<PlayerDetailView viewerId={1} playerId={7} canDeleteRecords />);
      fireEvent.click(await screen.findByRole("button", { name: "テスト曲 기록 삭제" }));
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "삭제" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      const del = fetchMock.mock.calls.find((c) => c[1]?.method === "DELETE");
      expect(String(del?.[0])).toContain("/admin/players/7/charts/55/records");
      const gets = fetchMock.mock.calls.filter((c) => (c[1]?.method ?? "GET") === "GET");
      expect(gets.length).toBeGreaterThanOrEqual(2); // 처음 + 삭제 뒤 다시 받기
    });

    it("서버가 거절하면 문구를 보여 주고 상자를 닫지 않는다", async () => {
      fetchMock.mockImplementation((_input, init) =>
        Promise.resolve(
          init?.method === "DELETE"
            ? json({ code: "FORBIDDEN", message: "권한이 없습니다.", timestamp: "t" }, 403)
            : json(withEntry),
        ),
      );
      renderWith(<PlayerDetailView viewerId={1} playerId={7} canDeleteRecords />);
      fireEvent.click(await screen.findByRole("button", { name: "テスト曲 기록 삭제" }));
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "삭제" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
  });
});
