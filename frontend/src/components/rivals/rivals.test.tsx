import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RivalButtons } from "@/components/rivals/RivalButtons";
import { RivalCompareView } from "@/components/rivals/RivalCompareView";
import { RivalRecordsCard } from "@/components/rivals/RivalRecordsCard";
import { RivalTab } from "@/components/rivals/RivalTab";
import type { PageResponse, RivalCompareRatingResponse, RivalRegistrantResponse, RivalResponse } from "@/lib/api-types";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";

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

function registrant(userId: number, nickname: string, mutual: boolean): RivalRegistrantResponse {
  return { userId, nickname, tier: gold, mutual };
}
function registrantPage(content: RivalRegistrantResponse[], over: Partial<PageResponse<RivalRegistrantResponse>> = {}) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0, ...over };
}

describe("RivalTab", () => {
  it("라이벌 카드는 비교 화면 링크이고, 비공개가 된 상대는 해제 버튼만 있다", async () => {
    const rivals: RivalResponse[] = [
      { userId: 7, nickname: "Rumi", available: true, mutual: true, tier: gold, totalScore: 9516.42, scoreDiff: 312.1,
        counts: { win: 48, lose: 61, tie: 3, theirsOnly: 27 } },
      { userId: 9, nickname: "HJY", available: false, mutual: false, tier: null, totalScore: null, scoreDiff: null, counts: null },
    ];
    fetchMock.mockImplementation(async (input) =>
      String(input).includes("/rivals/registered-me") ? json(registrantPage([])) : json(rivals));
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

describe("RivalTab - 나를 등록한 유저 (D63)", () => {
  const mine: RivalResponse[] = [];

  function mockApi(pages: (page: number) => PageResponse<RivalRegistrantResponse>, onRegister?: () => Response) {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/rivals/registered-me")) return json(pages(Number(new URL(url, "http://x").searchParams.get("page") ?? 0)));
      if (url.endsWith("/rivals") && init?.method === "POST") return onRegister ? onRegister() : new Response(null, { status: 204 });
      return json(mine);
    });
  }

  it("구역 제목, 줄(닉네임·티어·서로 라이벌 칩), 인원수를 보인다", async () => {
    mockApi(() => registrantPage([registrant(7, "Rumi", true), registrant(8, "Mika", false)]));
    renderWith(<RivalTab userId={1} />);

    const section = await screen.findByRole("region", { name: "나를 등록한 유저" });
    expect(await within(section).findByText("Rumi")).toHaveAttribute("href", "/players/7");
    expect(within(section).getByText("2명")).toBeInTheDocument();
    const rows = within(section).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Gold");
    expect(rows[0]).toHaveTextContent("서로 라이벌");
    expect(rows[1]).not.toHaveTextContent("서로 라이벌");
    // 이미 등록한 줄은 `등록됨` 글자로 막고, 아닌 줄만 `라이벌 등록`이 켜져 있다
    expect(within(rows[0]).getByRole("button", { name: /등록됨/ })).toBeDisabled();
    expect(within(rows[1]).getByRole("button", { name: /라이벌 등록/ })).toBeEnabled();
    // 요청에는 사용자 id가 없고 쪽 번호와 크기만 있다
    const call = fetchMock.mock.calls.map(urlOf).find((u) => u.includes("/rivals/registered-me"));
    expect(call).toContain("page=0");
    expect(call).not.toMatch(/userId|user_id/i);
  });

  it("비면 안내 한 줄만 보이고 비공개를 암시하는 문구는 없다", async () => {
    mockApi(() => registrantPage([]));
    renderWith(<RivalTab userId={1} />);

    expect(await screen.findByText("아직 나를 라이벌로 등록한 공개 유저가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("0명")).toBeInTheDocument();
    expect(screen.queryByText(/비공개/)).not.toBeInTheDocument();
  });

  it("줄에서 라이벌 등록을 누르면 기존 등록 API를 부르고 목록을 다시 읽는다", async () => {
    let registered = false;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/rivals/registered-me")) return json(registrantPage([registrant(8, "Mika", registered)]));
      if (url.endsWith("/rivals") && init?.method === "POST") {
        registered = true;
        return new Response(null, { status: 204 });
      }
      return json(mine);
    });
    renderWith(<RivalTab userId={1} />);

    const section = await screen.findByRole("region", { name: "나를 등록한 유저" });
    fireEvent.click(await within(section).findByRole("button", { name: /라이벌 등록/ }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => urlOf(c).endsWith("/rivals") && c[1]?.method === "POST");
      expect(post?.[1]?.body).toBe(JSON.stringify({ targetUserId: 8 }));
    });
    expect(await within(section).findByRole("button", { name: /등록됨/ })).toBeDisabled();
    expect(within(section).getByText("서로 라이벌")).toBeInTheDocument();
  });

  it("상한이 찼으면 서버의 오류 문구를 그대로 보인다", async () => {
    mockApi(
      () => registrantPage([registrant(8, "Mika", false)]),
      () => json({ code: "RIVAL_LIMIT", message: "라이벌은 5명까지 등록할 수 있습니다.", timestamp: "2026-11-07T00:00:00Z" }, 409),
    );
    renderWith(<RivalTab userId={1} />);

    const section = await screen.findByRole("region", { name: "나를 등록한 유저" });
    fireEvent.click(await within(section).findByRole("button", { name: /라이벌 등록/ }));

    expect(await within(section).findByRole("alert")).toHaveTextContent("라이벌은 5명까지 등록할 수 있습니다.");
  });

  it("여러 쪽이면 이전/다음으로 이동하고 쪽 번호를 서버에 보낸다", async () => {
    mockApi((page) =>
      registrantPage([registrant(10 + page, `user${page}`, false)], { page, totalPages: 2, totalElements: 21 }));
    renderWith(<RivalTab userId={1} />);

    const section = await screen.findByRole("region", { name: "나를 등록한 유저" });
    expect(await within(section).findByText("user0")).toBeInTheDocument();
    expect(within(section).getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "다음" }));

    expect(await within(section).findByText("user1")).toBeInTheDocument();
    expect(within(section).getByText("2 / 2")).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(urlOf).some((u) => u.includes("/rivals/registered-me") && u.includes("page=1"))).toBe(true);
  });
});

describe("나를 등록한 유저 문구", () => {
  it("ko/ja 둘 다 같은 키가 있다", () => {
    const keys = ["registeredMeTitle", "registeredMeCount", "registeredMeEmpty", "alreadyRegistered"] as const;
    for (const key of keys) {
      expect(ko.Rival[key]).toBeTruthy();
      expect(ja.Rival[key]).toBeTruthy();
    }
  });
});
