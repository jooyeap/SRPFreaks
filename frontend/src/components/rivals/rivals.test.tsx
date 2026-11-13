import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RivalButtons } from "@/components/rivals/RivalButtons";
import { RivalCompareView } from "@/components/rivals/RivalCompareView";
import { RivalRecordsCard } from "@/components/rivals/RivalRecordsCard";
import { RivalTab } from "@/components/rivals/RivalTab";
import type { PageResponse, RivalCompareRatingResponse, RivalRegistrantResponse, RivalResponse, RivalSummaryResponse } from "@/lib/api-types";
import { formatScoreDiff, myScoreDiff } from "@/lib/rivals";
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
    { rank: 1, songDifficultyId: 11, songId: 1, title: "KAISER PHOENIX", part: "GUITAR", difficulty: "MASTER", level: 9.9, tier: 9.0, pattern: "복합(단일)",
      rate: 95.2, stage: "SS", score: 238.1, myRate: 96, myScore: 240, diff: 1.9 },
    { rank: 2, songDifficultyId: 12, songId: 2, title: "Far East Nightbird", part: "GUITAR", difficulty: "MASTER", level: 9.0, tier: 8.5, pattern: "단일",
      rate: 88.9, stage: "S", score: 212.44, myRate: null, myScore: null, diff: null },
  ],
  other: [],
};

/** 대시보드 집계(D67) 최소 응답: 속성 다섯 줄은 항상 같은 순서로 온다. */
const summaryResponse: RivalSummaryResponse = {
  userId: 7,
  nickname: "Rumi",
  closeMargin: 1,
  totals: { wins: 10, ties: 2, losses: 7, closeCount: 4, sharedCount: 19, scoreDiffSum: 12.5 },
  patterns: [
    { pattern: "단일", key: "SINGLE", wins: 6, ties: 1, losses: 2, scoreDiffSum: 30.5, closeCount: 2, sharedCount: 9 },
    { pattern: "복합", key: "COMPOUND", wins: 0, ties: 0, losses: 0, scoreDiffSum: 0, closeCount: 0, sharedCount: 0 },
    { pattern: "복합(단일)", key: "COMPOSITE_SINGLE", wins: 4, ties: 1, losses: 5, scoreDiffSum: -18, closeCount: 2, sharedCount: 10 },
    { pattern: "이중", key: "DOUBLE", wins: 0, ties: 0, losses: 0, scoreDiffSum: 0, closeCount: 0, sharedCount: 0 },
    { pattern: "삼중", key: "TRIPLE", wins: 0, ties: 0, losses: 0, scoreDiffSum: 0, closeCount: 0, sharedCount: 0 },
  ],
  tiers: [],
  distribution: [],
};

/** 속성별 곡 목록(D67) 빈 응답: 대시보드 미리보기가 이 주소를 부른다. */
const emptyDetail = {
  userId: 7,
  nickname: "Rumi",
  summary: summaryResponse.patterns[0],
  filterCounts: { all: 0, lose: 0, close: 0, win: 0 },
  rows: { content: [], page: 0, size: 2, totalElements: 0, totalPages: 0 },
};

describe("RivalCompareView", () => {
  it("머리에 두 사람 총점과 총점 차·승무패를, 레이팅 목록 줄에 내 점수와 차이 칩을 부호 글자로 보인다", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/compare/summary/")) return json(emptyDetail);
      if (url.includes("/compare/summary")) return json(summaryResponse);
      return json(ratingResponse);
    });
    renderWith(<RivalCompareView viewerId={1} targetId={7} />);

    expect(await screen.findByRole("heading", { name: "나 vs Rumi" })).toBeInTheDocument();
    const summary = await screen.findByRole("region", { name: "라이벌 대시보드" });
    expect(summary).toHaveTextContent("9204.32");
    expect(summary).toHaveTextContent("9516.42");
    // 총점 차 = 내 총점 - 상대 총점(부호 글자)
    expect(summary).toHaveTextContent("\u2212312.10");
    expect(summary).toHaveTextContent("승 10 무 2 패 7");
    expect(screen.getByText("+0.80%")).toBeInTheDocument(); // 달성률 차: 내 96 − 상대 95.2
    expect(screen.getByText("나 240.00")).toBeInTheDocument();
    expect(screen.getByText("내 기록 없음")).toBeInTheDocument();
    // 목록 맨 아래 안내(내 달성률 − 상대 달성률): 줄의 칩이 달성률 차라서 안내도 같은 기준이다
    expect(screen.getByText("+는 내가 앞, \u2212는 내가 뒤 (내 달성률 \u2212 상대 달성률)")).toBeInTheDocument();
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
      if (url.includes("/compare/summary/")) return json(emptyDetail);
      if (url.includes("/compare/summary")) return json(summaryResponse);
      return json(ratingResponse);
    });
    renderWith(<RivalCompareView viewerId={1} targetId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "곡별 승패" }));

    const row = (await screen.findByRole("link", { name: /MEGALOVANIA/ })).closest("li") as HTMLElement;
    expect(row).toHaveTextContent(/나\s*95\.63/);   // 달성률 자리에 `나`/`상대` 라벨(2026-11-10)
    expect(row).toHaveTextContent(/상대\s*96\.10/);
    expect(row).toHaveTextContent("95.63");
    expect(row).toHaveTextContent("96.10");
    expect(row).toHaveTextContent("\u22120.47%");   // 차이 칸에 %가 붙고 부호는 글자(−)로 보인다
    expect(row).not.toHaveTextContent("-0.47");
    expect(screen.getByRole("button", { name: "패 61" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock.mock.calls.some((c) => urlOf(c).includes("result=LOSE"))).toBe(true);
  });

  it("곡별 승패 줄의 윗줄은 응답의 속성과 서열 난이도로 `속성 | 난이도`가 채워진다 (D67 개정)", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/compare/charts")) {
        return json({
          counts: ratingResponse.counts,
          page: {
            content: [{ songDifficultyId: 5, songId: 3, title: "MEGALOVANIA", part: "BASS", difficulty: "MASTER", level: 8.65,
              myRate: 95.63, theirRate: 96.1, diff: -0.47, tier: 5.4, pattern: "복합(단일)" }],
            page: 0, size: 20, totalElements: 1, totalPages: 1,
          },
        });
      }
      if (url.includes("/compare/summary/")) return json(emptyDetail);
      if (url.includes("/compare/summary")) return json(summaryResponse);
      return json(ratingResponse);
    });
    renderWith(<RivalCompareView viewerId={1} targetId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "곡별 승패" }));

    const row = (await screen.findByRole("link", { name: /MEGALOVANIA/ })).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("복합(단일)");
    expect(row).toHaveTextContent("5.4");
    // 속성 칸이 더는 `–`가 아니다
    const top = row.querySelector("p.text-\\[10px\\]") as HTMLElement | null;
    expect(top?.textContent ?? "").not.toMatch(/^[\s]*–/);
  });

  it("곡별 승패 줄의 속성·서열 난이도가 없는 옛 응답에서도 깨지지 않고 속성 칸은 `–`로 보인다 (D67 개정)", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/compare/charts")) {
        return json({
          counts: ratingResponse.counts,
          page: {
            content: [{ songDifficultyId: 5, songId: 3, title: "OLDSHAPE", part: "GUITAR", difficulty: "MASTER", level: 8.65,
              myRate: 95.63, theirRate: 96.1, diff: -0.47 }],
            page: 0, size: 20, totalElements: 1, totalPages: 1,
          },
        });
      }
      if (url.includes("/compare/summary/")) return json(emptyDetail);
      if (url.includes("/compare/summary")) return json(summaryResponse);
      return json(ratingResponse);
    });
    renderWith(<RivalCompareView viewerId={1} targetId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "곡별 승패" }));

    const row = (await screen.findByRole("link", { name: /OLDSHAPE/ })).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("OLDSHAPE");
    expect(row).toHaveTextContent("–");
    expect(row).toHaveTextContent("\u22120.47%");
  });

  it("곡별 승패의 탭 개수는 곡별 승패 응답의 counts를 쓰고(레이팅 비교 응답의 counts가 아니다) 캡션은 상단 요약과 같은 기준이라고 말한다 (D67 개정)", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/compare/charts")) {
        // 대시보드 totals(승 10 무 2 패 7)와 같은 범위·판정의 개수 + 상대만 4곡, 나만 1곡
        return json({
          counts: { win: 10, lose: 7, tie: 2, theirsOnly: 4, onlyMine: 1 },
          page: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
        });
      }
      if (url.includes("/compare/summary/")) return json(emptyDetail);
      if (url.includes("/compare/summary")) return json(summaryResponse);
      return json(ratingResponse); // counts: 승 48 패 61 무 3 상대만 27 (옛 기준 — 탭에 쓰이면 안 된다)
    });
    renderWith(<RivalCompareView viewerId={1} targetId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "곡별 승패" }));

    expect(await screen.findByRole("button", { name: "패 7" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "승 10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "무 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "상대만 4" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "패 61" })).toBeNull();
    // 위 대시보드 요약(승 10 무 2 패 7)과 같은 숫자다
    expect(screen.getByRole("region", { name: "라이벌 대시보드" })).toHaveTextContent("승 10 무 2 패 7");
    expect(screen.getByText("상단 요약과 같은 기준입니다. 차이가 작은 순")).toBeInTheDocument();
  });

  it("상대만 탭은 상대 달성률이 높은 순이라는 캡션을 보이고, 옛 응답(onlyMine 없음)에서도 깨지지 않는다", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/compare/charts")) {
        return json({
          counts: { win: 1, lose: 1, tie: 1, theirsOnly: 2 }, // onlyMine 없음(옛 응답)
          page: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
        });
      }
      if (url.includes("/compare/summary/")) return json(emptyDetail);
      if (url.includes("/compare/summary")) return json(summaryResponse);
      return json(ratingResponse);
    });
    renderWith(<RivalCompareView viewerId={1} targetId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "곡별 승패" }));
    fireEvent.click(await screen.findByRole("button", { name: "상대만 2" }));

    expect(await screen.findByText("상대만 기록한 곡입니다. 상대 달성률이 높은 순")).toBeInTheDocument();
    expect(screen.queryByText("상단 요약과 같은 기준입니다. 차이가 작은 순")).toBeNull();
    expect(screen.getByRole("button", { name: "상대만 2" })).toHaveAttribute("aria-pressed", "true");
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
      { userId: 7, nickname: "Rumi", rate: 96.1, diff: 0.3, stage: "SS" },
      { userId: 8, nickname: "KJY", rate: 98.02, diff: -1.62, stage: "FC" },
      { userId: 9, nickname: "HSB", rate: null, diff: null, stage: null },
    ]));
    renderWith(<RivalRecordsCard viewerId={1} songDifficultyId={5} />);

    const card = await screen.findByRole("region", { name: "라이벌 기록" });
    const items = within(card).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("+0.30");
    expect(items[0]).toHaveTextContent("승");
    // 상대 달성률 옆 단계 글자 칩(D65). 기록이 없는 줄에는 칩이 없다
    expect(within(items[0]).getByText("SS")).toBeInTheDocument();
    expect(within(items[1]).getByText("FC")).toBeInTheDocument();
    expect(within(items[2]).queryByText(/^(C|B|A|S|SS|FC|EXC)$/)).toBeNull();
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
    // 서버 scoreDiff 312.1 = 상대 − 나(상대가 높음) → 카드는 비교 화면과 같은 부호(내 − 상대)라 −312.10, "나보다" 표기는 없다.
    expect(card).toHaveTextContent("총점 차 \u2212312.10");
    expect(card).not.toHaveTextContent("나보다");
    expect(screen.getByText("상대가 기록을 비공개로 바꿨습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "라이벌 해제" })).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("카드의 승·패·무·상대만 숫자는 서버가 준 값 그대로다(대시보드와 같은 기준으로 서버가 센다, D67 개정)", async () => {
    // 대시보드 요약(승 18 무 0 패 24)과 같은 숫자가 카드에도 내려온다. 화면은 다시 세지 않는다.
    const rivals: RivalResponse[] = [
      { userId: 7, nickname: "Rumi", available: true, mutual: false, tier: gold, totalScore: 9516.42, scoreDiff: 312.1,
        counts: { win: 18, lose: 24, tie: 0, theirsOnly: 6, onlyMine: 2 } },
    ];
    fetchMock.mockImplementation(async (input) =>
      String(input).includes("/rivals/registered-me") ? json(registrantPage([])) : json(rivals));
    renderWith(<RivalTab userId={1} />);

    const card = await screen.findByRole("link", { name: /Rumi/ });
    expect(card).toHaveTextContent("18");
    expect(card).toHaveTextContent("24");
    expect(card).toHaveTextContent("6");
    expect(card).not.toHaveTextContent("48");
    expect(card).not.toHaveTextContent("61");
  });
});

describe("RivalTab - 순서·부호 통일 (2026-11-12)", () => {
  const rivalWith = (scoreDiff: number): RivalResponse => ({
    userId: 7, nickname: "Rumi", available: true, mutual: false, tier: gold, totalScore: 9000,
    scoreDiff, counts: { win: 18, lose: 24, tie: 2, theirsOnly: 6 },
  });
  async function renderCard(scoreDiff: number) {
    fetchMock.mockImplementation(async (input) =>
      String(input).includes("/rivals/registered-me") ? json(registrantPage([])) : json([rivalWith(scoreDiff)]));
    renderWith(<RivalTab userId={1} />);
    return screen.findByRole("link", { name: /Rumi/ });
  }

  it("카드의 칸 순서는 비교 화면과 같은 승 · 무 · 패 · 상대만이고 글자가 함께 보인다", async () => {
    const card = await renderCard(10);
    const labels = ["승", "무", "패", "상대만"].map((l) => card.textContent!.indexOf(l, card.textContent!.indexOf("총점 차")));
    expect(labels.every((i) => i >= 0)).toBe(true);
    expect([...labels].sort((a, b) => a - b)).toEqual(labels);
    // 숫자도 글자 바로 옆 칸 순서(18 승, 2 무, 24 패, 6 상대만)를 따른다.
    const cells = [...card.querySelectorAll("span.grid > span")].map((c) => c.textContent);
    expect(cells).toEqual(["18승", "2무", "24패", "6상대만"]);
  });

  it("총점 차는 항상 내 점수 − 상대 점수: 서버 값이 상대 − 나이므로 부호가 뒤집혀 보인다", async () => {
    expect(await renderCard(930.3)).toHaveTextContent("총점 차 \u2212930.30"); // 상대가 높음 → 내가 뒤 → 마이너스
  });

  it("내가 앞이면 플러스, 같으면 ±0.00", async () => {
    expect(await renderCard(-64.5)).toHaveTextContent("총점 차 +64.50");
  });

  it("myScoreDiff 한 곳에서만 부호를 뒤집는다(0과 null 처리)", () => {
    expect(myScoreDiff(312.1)).toBe(-312.1);
    expect(myScoreDiff(-5)).toBe(5);
    expect(myScoreDiff(0)).toBe(0);
    expect(Object.is(myScoreDiff(0), 0)).toBe(true);
    expect(myScoreDiff(null)).toBeNull();
    expect(formatScoreDiff(myScoreDiff(0))?.text).toBe("\u00b10.00");
  });

  it("비교 화면 대시보드의 총점 차와 같은 값·같은 표기다(두 화면 모두 formatScoreDiff)", () => {
    // 비교 화면: myTotalScore − totalScore = 9000 − 9930.3 = −930.3 / 카드: 서버 scoreDiff(상대 − 나) = 930.3
    const dashboard = formatScoreDiff(Math.round((9000 - 9930.3) * 100) / 100)?.text;
    const card = formatScoreDiff(myScoreDiff(930.3))?.text;
    expect(card).toBe(dashboard);
    expect(card).toBe("\u2212930.30");
  });

  it("scoreLine 문구: ko는 `총점 차`, ja는 `総合点差`이고 옛 `나보다`/`自分との差`는 없다", () => {
    expect(ko.Rival.scoreLine).toBe("총점 <n>{total}</n> · 총점 차 <n>{diff}</n>");
    expect(ja.Rival.scoreLine).toBe("総合 <n>{total}</n> · 総合点差 <n>{diff}</n>");
    expect(ko.Rival.scoreLine).not.toContain("나보다");
    expect(ja.Rival.scoreLine).not.toContain("自分との差");
  });
});

describe("곡별 승패 캡션 문구 (ko/ja)", () => {
  it("승·패·무 탭과 상대만 탭의 캡션이 다르고 ja도 같은 구분이다", () => {
    expect(ko.Rival.chartsBasis).toBe("상단 요약과 같은 기준입니다. 차이가 작은 순");
    expect(ko.Rival.chartsBasisTheirs).toBe("상대만 기록한 곡입니다. 상대 달성률이 높은 순");
    expect(ja.Rival.chartsBasis).toBe("上のサマリーと同じ基準です。差が小さい順");
    expect(ja.Rival.chartsBasisTheirs).toBe("相手だけが記録した曲です。相手の達成率が高い順");
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
