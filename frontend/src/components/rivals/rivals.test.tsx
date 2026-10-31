import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RivalButtons } from "@/components/rivals/RivalButtons";
import { RivalCompareView } from "@/components/rivals/RivalCompareView";
import { RivalRecordsCard } from "@/components/rivals/RivalRecordsCard";
import { RivalTab } from "@/components/rivals/RivalTab";
import type { RivalCompareRatingResponse, RivalResponse } from "@/lib/api-types";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function renderWith(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const gold = { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" };
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function urlOf(call: Parameters<typeof fetch>): string {
  return String(call[0]);
}

describe("RivalButtons", () => {
  it("등록하지 않았으면 `라이벌 등록`을 누르면 등록 요청을 보낸다", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/rival-status")) return json({ registered: false, mutual: false, count: 1, max: 5 });
      if (url.endsWith("/rivals") && init?.method === "POST") return new Response(null, { status: 204 });
      return json({}, 404);
    });
    renderWith(<RivalButtons viewerId={1} targetId={7} nickname="Rumi" />);

    const button = await screen.findByRole("button", { name: /라이벌 등록/ });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByText("라이벌 1/5명 · 등록해도 상대에게 알리지 않습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "비교" })).toHaveAttribute("href", "/players/7/compare");

    fireEvent.click(button);
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => urlOf(c).endsWith("/rivals") && c[1]?.method === "POST")).toBe(true),
    );
  });

  it("5명이 찼으면 등록 버튼을 막고 안내한다", async () => {
    fetchMock.mockResolvedValue(json({ registered: false, mutual: false, count: 5, max: 5 }));
    renderWith(<RivalButtons viewerId={1} targetId={7} nickname="Rumi" />);
    expect(await screen.findByText("라이벌은 5명까지 등록할 수 있습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /라이벌 등록/ })).toBeDisabled();
  });

  it("서로 등록이면 글자로 보인다", async () => {
    fetchMock.mockResolvedValue(json({ registered: true, mutual: true, count: 2, max: 5 }));
    renderWith(<RivalButtons viewerId={1} targetId={7} nickname="Rumi" />);
    expect(await screen.findByRole("button", { name: /라이벌 · 서로 등록/ })).toHaveAttribute("aria-pressed", "true");
  });
});

const ratingResponse: RivalCompareRatingResponse = {
  userId: 7,
  nickname: "Rumi",
  tier: gold,
  totalScore: 9516.42,
  myTier: gold,
  myTotalScore: 9204.32,
  counts: { win: 48, lose: 61, tie: 3, theirsOnly: 27 },
  single: [
    { rank: 1, songDifficultyId: 11, songId: 1, title: "KAISER PHOENIX", part: "GUITAR", difficulty: "MASTER", level: 9.9, tier: 9.0,
      rate: 95.2, stage: "SS", score: 238.1, myRate: 96, myScore: 240, diff: 1.9 },
    { rank: 2, songDifficultyId: 12, songId: 2, title: "Far East Nightbird", part: "GUITAR", difficulty: "MASTER", level: 9.0, tier: 8.5,
      rate: 88.9, stage: "S", score: 212.44, myRate: null, myScore: null, diff: null },
  ],
  other: [],
};

describe("RivalCompareView", () => {
  it("머리에 두 사람 총점과 승패를, 레이팅 목록 줄에 내 차이를 화살표 글자로 보인다", async () => {
    fetchMock.mockResolvedValue(json(ratingResponse));
    renderWith(<RivalCompareView viewerId={1} targetId={7} />);

    expect(await screen.findByRole("heading", { name: "나 vs Rumi" })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "비교 요약" });
    expect(summary).toHaveTextContent("9204.32");
    expect(summary).toHaveTextContent("48 · 61 · 3");
    expect(summary).toHaveTextContent("상대만 27곡");
    expect(screen.getByText("1.90↑")).toBeInTheDocument();
    expect(screen.getByText("없음")).toBeInTheDocument();
  });

  it("곡별 승패로 바꾸면 진 곡 목록을 받아 위 나 / 아래 상대 달성률과 차이를 보인다", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/compare/charts")) {
        return json({
          counts: ratingResponse.counts,
          page: {
            content: [{ songDifficultyId: 5, songId: 3, title: "MEGALOVANIA", part: "BASS", difficulty: "MASTER", level: 8.65,
              myRate: 95.63, theirRate: 96.1, diff: -0.47 }],
            page: 0, size: 20, totalElements: 1, totalPages: 1,
          },
        });
      }
      return json(ratingResponse);
    });
    renderWith(<RivalCompareView viewerId={1} targetId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "곡별 승패" }));

    const row = await screen.findByRole("link", { name: /MEGALOVANIA/ });
    expect(row).toHaveTextContent("95.63");
    expect(row).toHaveTextContent("96.10");
    expect(row).toHaveTextContent("-0.47");
    expect(screen.getByRole("button", { name: "패 61" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock.mock.calls.some((c) => urlOf(c).includes("result=LOSE"))).toBe(true);
  });

  it("상대가 비공개면(404) 찾을 수 없다고 안내한다", async () => {
    fetchMock.mockResolvedValue(json({ code: "NOT_FOUND", message: "찾을 수 없습니다." }, 404));
    renderWith(<RivalCompareView viewerId={1} targetId={7} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("RivalRecordsCard", () => {
  it("라이벌 기록과 차이를 승/패 글자와 함께 보이고 기록 없는 라이벌은 `없음`이다", async () => {
    fetchMock.mockResolvedValue(json([
      { userId: 7, nickname: "Rumi", rate: 96.1, diff: 0.3 },
      { userId: 8, nickname: "KJY", rate: 98.02, diff: -1.62 },
      { userId: 9, nickname: "HSB", rate: null, diff: null },
    ]));
    renderWith(<RivalRecordsCard viewerId={1} songDifficultyId={5} />);

    const card = await screen.findByRole("region", { name: "라이벌 기록" });
    const items = within(card).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("+0.30");
    expect(items[0]).toHaveTextContent("승");
    expect(items[1]).toHaveTextContent("-1.62");
    expect(items[1]).toHaveTextContent("패");
    expect(items[2]).toHaveTextContent("없음");
  });

  it("라이벌이 없으면 아무것도 그리지 않는다", async () => {
    fetchMock.mockResolvedValue(json([]));
    const { container } = renderWith(<RivalRecordsCard viewerId={1} songDifficultyId={5} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RivalTab", () => {
  it("라이벌 카드는 비교 화면 링크이고, 비공개가 된 상대는 해제 버튼만 있다", async () => {
    const rivals: RivalResponse[] = [
      { userId: 7, nickname: "Rumi", available: true, mutual: true, tier: gold, totalScore: 9516.42, scoreDiff: 312.1,
        counts: { win: 48, lose: 61, tie: 3, theirsOnly: 27 } },
      { userId: 9, nickname: "HJY", available: false, mutual: false, tier: null, totalScore: null, scoreDiff: null, counts: null },
    ];
    fetchMock.mockResolvedValue(json(rivals));
    renderWith(<RivalTab userId={1} />);

    const card = await screen.findByRole("link", { name: /Rumi/ });
    expect(card).toHaveAttribute("href", "/players/7/compare");
    expect(card).toHaveTextContent("서로 라이벌");
    expect(card).toHaveTextContent("+312.10");
    expect(screen.getByText("상대가 기록을 비공개로 바꿨습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "라이벌 해제" })).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });
});
