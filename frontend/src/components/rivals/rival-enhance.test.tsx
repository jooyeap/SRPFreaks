import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import { resetShowJacketsForTest, setJacketData } from "@/lib/jackets";

// 라이벌 속성별 비교 보강(2026-11-10): 결론 문장 카드, 속성 줄 기록·점수 차, 난이도대별 막대, `상대만` 필터, 곡별 승패 공통 줄.
const state = vi.hoisted(() => ({ locale: "ko" as "ko" | "ja" }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    createTranslator({ locale: state.locale, messages: state.locale === "ja" ? ja : ko, namespace } as never),
  useLocale: () => state.locale,
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

import { RivalCompareView } from "@/components/rivals/RivalCompareView";
import { RivalPatternDetailView } from "@/components/rivals/RivalPatternDetailView";
import type {
  RivalCompareRatingResponse,
  RivalDetailRow,
  RivalPatternSummary,
  RivalSummaryDetailResponse,
  RivalSummaryResponse,
} from "@/lib/api-types";
import { conclusionOf, recordCounts } from "@/lib/rival-dashboard";
import { formatScoreDiffTenths } from "@/lib/rivals";

const MINUS = "−";
const gold = { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" };
const rating: RivalCompareRatingResponse = {
  userId: 7, nickname: "Rumi", tier: gold, totalScore: 9516.42, myTier: gold, myTotalScore: 9204.32,
  counts: { win: 1, lose: 1, tie: 1, theirsOnly: 1 }, single: [], other: [],
};
function pattern(key: RivalPatternSummary["key"], label: string, over: Partial<RivalPatternSummary> = {}): RivalPatternSummary {
  return { pattern: label, key, wins: 0, ties: 0, losses: 0, scoreDiffSum: 0, closeCount: 0, sharedCount: 0, rateDiffAvg: null, ...over };
}
const PATTERNS: RivalPatternSummary[] = [
  pattern("SINGLE", "단일", { wins: 6, ties: 1, losses: 2, closeCount: 2, sharedCount: 9, rateDiffAvg: 1.8, onlyMine: 2, onlyTheirs: 0, ratingScoreDiff: 12.34 }),
  pattern("COMPOUND", "복합"),
  pattern("COMPOSITE_SINGLE", "복합(단일)"),
  pattern("DOUBLE", "이중"),
  pattern("TRIPLE", "삼중", { wins: 0, ties: 2, losses: 3, sharedCount: 5, rateDiffAvg: -3.2, onlyMine: 1, onlyTheirs: 8, ratingScoreDiff: -222.04 }),
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

function summaryOf(patterns: RivalPatternSummary[]): RivalSummaryResponse {
  return {
    userId: 7, nickname: "Rumi", closeMargin: 1,
    totals: { wins: 6, ties: 3, losses: 5, closeCount: 2, sharedCount: 14, scoreDiffSum: 0 }, patterns, tiers: [],
    distribution: patterns.map((p) => ({ pattern: p.pattern, key: p.key, diffs: [] })),
    rateDistribution: patterns.map((p) => ({ pattern: p.pattern, key: p.key, diffs: [] })),
  };
}
const emptyDetail = (p: RivalPatternSummary): RivalSummaryDetailResponse => ({
  userId: 7, nickname: "Rumi", summary: p, filterCounts: { all: 0, lose: 0, close: 0, win: 0 },
  rows: { content: [], page: 0, size: 2, totalElements: 0, totalPages: 0 },
});

function showDashboard(patterns: RivalPatternSummary[] = PATTERNS) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    const detail = /\/compare\/summary\/([A-Z_]+)$/.exec(url.pathname);
    if (detail) return json(emptyDetail(patterns.find((p) => p.key === detail[1]) ?? patterns[0]));
    if (url.pathname.endsWith("/compare/summary")) return json(summaryOf(patterns));
    if (url.pathname.endsWith("/compare/rating")) return json(rating);
    if (url.pathname.endsWith("/setlist")) return json({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 30 });
    return json({}, 404);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  Element.prototype.scrollIntoView = vi.fn();
  return render(
    <QueryClientProvider client={client}>
      <RivalCompareView viewerId={1} targetId={7} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.locale = "ko";
  localStorage.clear();
  resetShowJacketsForTest();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => setJacketData(null));
});

describe("결론 문장·기록 수 계산 (순수 함수)", () => {
  it("기록 수 = 공유 곡 + 한쪽만(필드가 없는 옛 응답은 0으로 본다)", () => {
    expect(recordCounts(PATTERNS[4])).toEqual({ mine: 6, theirs: 13 });
    expect(recordCounts(pattern("DOUBLE", "이중", { sharedCount: 3 }))).toEqual({ mine: 3, theirs: 3 });
  });

  it("우세·열세는 평균 달성률 차 기준, 점수 차는 절댓값이 가장 큰 속성, 상대가 더 기록한 곡 수는 열세 속성에서만", () => {
    const c = conclusionOf(PATTERNS);
    expect(c.strong?.key).toBe("SINGLE");
    expect(c.weak?.key).toBe("TRIPLE");
    expect(c.biggest?.key).toBe("TRIPLE");
    expect(c.moreTheirs).toBe(7); // 상대 13 − 나 6
    // 열세 속성에서 내가 더 많이 기록했으면 문장을 숨긴다(null)
    const mineMore = conclusionOf([pattern("TRIPLE", "삼중", { sharedCount: 5, rateDiffAvg: -1, onlyMine: 4, onlyTheirs: 1 })]);
    expect(mineMore.moreTheirs).toBeNull();
    // 점수 차가 하나도 없으면 biggest는 null
    expect(conclusionOf([pattern("SINGLE", "단일", { sharedCount: 3, rateDiffAvg: 1 })]).biggest).toBeNull();
  });

  it("점수 차 표시는 소수 첫째 자리와 부호 글자", () => {
    expect(formatScoreDiffTenths(-222.04)?.text).toBe(`${MINUS}222.0`);
    expect(formatScoreDiffTenths(64)?.text).toBe("+64.0");
    expect(formatScoreDiffTenths(0.04)?.text).toBe("±0.0");
    expect(formatScoreDiffTenths(null)).toBeNull();
  });
});

describe("대시보드 결론 문장 카드와 속성 줄 기록·점수 차", () => {
  it("첫 줄 `단일 +1.8% 우세 · 삼중 −3.2% 열세`, 둘째 줄 `총점 차 … 중 삼중이 …이에요. 삼중은 상대가 7곡 더 기록했어요.`", async () => {
    showDashboard();
    const card = await screen.findByTestId("rival-conclusion");
    expect(card).toHaveTextContent(`단일 +1.8% 우세 · 삼중 ${MINUS}3.2% 열세`);
    expect(card).toHaveTextContent(`총점 차 ${MINUS}312.1 중 삼중이 ${MINUS}222.0이에요. 삼중은 상대가 7곡 더 기록했어요.`);
    expect(card).not.toHaveTextContent("앞서");
    expect(card).not.toHaveTextContent("뒤져");
  });

  it("열세 속성에서 내 기록이 더 많으면 `상대가 N곡 더 기록했어요`만 숨긴다", async () => {
    showDashboard([
      pattern("SINGLE", "단일", { wins: 6, sharedCount: 9, rateDiffAvg: 1.8, ratingScoreDiff: 12.34 }),
      pattern("COMPOUND", "복합"), pattern("COMPOSITE_SINGLE", "복합(단일)"), pattern("DOUBLE", "이중"),
      pattern("TRIPLE", "삼중", { losses: 3, sharedCount: 5, rateDiffAvg: -3.2, onlyMine: 4, onlyTheirs: 1, ratingScoreDiff: -222.04 }),
    ]);
    const card = await screen.findByTestId("rival-conclusion");
    expect(card).toHaveTextContent("중 삼중이");
    expect(card).not.toHaveTextContent("더 기록했어요");
  });

  it("옛 응답(ratingScoreDiff·onlyX 없음)이면 둘째 줄이 없고 첫 줄만 보인다. 속성 줄에는 기록 수만 있고 점수 차 항이 없다", async () => {
    showDashboard([
      pattern("SINGLE", "단일", { wins: 6, sharedCount: 9, rateDiffAvg: 1.8 }),
      pattern("COMPOUND", "복합"), pattern("COMPOSITE_SINGLE", "복합(단일)"), pattern("DOUBLE", "이중"), pattern("TRIPLE", "삼중"),
    ]);
    const card = await screen.findByTestId("rival-conclusion");
    expect(card).toHaveTextContent("단일 +1.8% 우세");
    expect(card).not.toHaveTextContent("총점 차");
    expect(screen.getByRole("link", { name: /단일/ })).toHaveTextContent("기록 나 9 · 상대 9곡");
    expect(screen.getByRole("link", { name: /단일/ })).not.toHaveTextContent("점수 차");
  });

  it("속성 줄 아래 `기록 나 11 · 상대 23곡 · 점수 차 −222.0`(부호는 글자, 색은 토큰 클래스)", async () => {
    showDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "열세 1" }));
    const link = await screen.findByRole("link", { name: /삼중/ });
    expect(link).toHaveTextContent(`기록 나 6 · 상대 13곡 · 점수 차 ${MINUS}222.0`);
    expect(within(link).getByText(`점수 차 ${MINUS}222.0`)).toHaveClass("text-weak-text");
  });

  it("일본어는 우세·劣勢와 초안 문구로 같은 구조", async () => {
    state.locale = "ja";
    showDashboard();
    const card = await screen.findByTestId("rival-conclusion");
    expect(card).toHaveTextContent(`優勢`);
    expect(card).toHaveTextContent(`劣勢`);
    expect(card).toHaveTextContent("総合点差");
  });
});

describe("속성 상세: 난이도대별 막대와 상대만 필터", () => {
  const theirsRow = (id: number): RivalDetailRow => ({
    songDifficultyId: id, songId: 100 + id, title: `Only ${id}`, part: "BASS", difficulty: "EXTREME", level: 9.2, tier: 5.6, pattern: "삼중",
    rate: 96, stage: "SS", score: 240, myRate: null, myStage: null, myScore: null, diff: null, rateDiff: null,
  });
  function base(over: Partial<RivalSummaryDetailResponse> = {}): RivalSummaryDetailResponse {
    return {
      userId: 7, nickname: "Rumi",
      summary: { pattern: "삼중", key: "TRIPLE", wins: 4, ties: 1, losses: 6, scoreDiffSum: -42.67, closeCount: 3, sharedCount: 11 },
      filterCounts: { all: 11, lose: 6, close: 3, win: 4, theirsOnly: 2 },
      tiers: [
        { tier: 5.6, wins: 1, ties: 0, losses: 2, closeCount: 0, sharedCount: 3, rateDiffAvg: -1.2 },
        { tier: 5.5, wins: 0, ties: 0, losses: 0, closeCount: 0, sharedCount: 0, rateDiffAvg: null },
      ],
      rows: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
      ...over,
    };
  }
  function showDetail(body: RivalSummaryDetailResponse, filter: React.ComponentProps<typeof RivalPatternDetailView>["filter"] = "ALL") {
    fetchMock.mockImplementation(async (input) => {
      if (String(input).includes("/setlist")) return json({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 30 });
      return json(body);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <RivalPatternDetailView viewerId={1} targetId={7} patternKey="TRIPLE" filter={filter} page={0} from={null} onFilterChange={vi.fn()} onPageChange={vi.fn()} />
      </QueryClientProvider>,
    );
  }

  it("`난이도대별 (서열표 기준)` 섹션이 속성 막대와 같은 모양(패·승 글자, 평균 달성률 차 %, 공유 곡 없으면 –)과 안내 한 줄로 나온다", async () => {
    showDetail(base());
    const section = await screen.findByRole("region", { name: "난이도대별 (서열표 기준)" });
    const list = within(section).getByRole("list", { name: "난이도대별 승패" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("5.6");
    expect(items[0]).toHaveTextContent("패 2");
    expect(items[0]).toHaveTextContent("승 1");
    expect(items[0]).toHaveTextContent(`${MINUS}1.2%`);
    expect(items[1]).toHaveTextContent("5.5");
    expect(items[1]).toHaveTextContent("–");
    expect(section).toHaveTextContent("막대: 왼쪽 패(열세) · 오른쪽 승(우세) · 오른쪽 숫자는 평균 달성률 차");
  });

  it("옛 응답(tiers 없음)이면 난이도대별 섹션을 그리지 않는다", async () => {
    showDetail(base({ tiers: undefined, filterCounts: { all: 11, lose: 6, close: 3, win: 4 } }));
    await screen.findByRole("heading", { name: /Rumi/ });
    expect(screen.queryByRole("region", { name: "난이도대별 (서열표 기준)" })).toBeNull();
  });

  it("필터 칩 끝에 `상대만 2`가 있고, 상대만 줄은 `내 기록 없음` 칩과 줄별 `담기` 버튼이 있다", async () => {
    showDetail(base({ rows: { content: [theirsRow(1), theirsRow(2)], page: 0, size: 20, totalElements: 2, totalPages: 1 } }), "THEIRS_ONLY");
    await screen.findByRole("heading", { name: /Rumi/ });
    const chips = within(screen.getByRole("group", { name: "필터" })).getAllByRole("button");
    expect(chips[chips.length - 1]).toHaveTextContent("상대만 2");
    expect(chips[chips.length - 1]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("내 기록 없음")).toHaveLength(2);
    expect(await screen.findByRole("button", { name: /Only 1/ })).toHaveTextContent("담기");
    expect(screen.getByRole("button", { name: /Only 2/ })).toHaveTextContent("담기");
  });

  it("일본어: 칩 `相手のみ`, 섹션 제목 초안", async () => {
    state.locale = "ja";
    showDetail(base());
    expect(await screen.findByRole("region", { name: "難易度帯別（難易度表基準）" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "相手のみ 2" })).toBeInTheDocument();
  });
});

describe("곡별 승패 목록: 공통 줄", () => {
  const chartRows = [
    { songDifficultyId: 5, songId: 3, title: "MEGALOVANIA", part: "BASS", difficulty: "MASTER", level: 8.65, myRate: 95.63, theirRate: 96.1, diff: -0.47 },
    { songDifficultyId: 6, songId: 4, title: "Only Theirs", part: "GUITAR", difficulty: "EXTREME", level: 7.1, myRate: null, theirRate: 91, diff: null },
  ];
  function showCharts() {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/compare/charts")) {
        return json({
          counts: { win: 1, lose: 1, tie: 0, theirsOnly: 1, onlyMine: 0 },
          page: { content: chartRows, page: 0, size: 20, totalElements: 2, totalPages: 1 },
        });
      }
      if (url.includes("/compare/summary/")) return json(emptyDetail(PATTERNS[0]));
      if (url.includes("/compare/summary")) return json(summaryOf(PATTERNS));
      return json(rating);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    Element.prototype.scrollIntoView = vi.fn();
    return render(
      <QueryClientProvider client={client}>
        <RivalCompareView viewerId={1} targetId={7} />
      </QueryClientProvider>,
    );
  }
  const lines = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "곡별 승패" }));
    await screen.findByText("MEGALOVANIA");
    return screen.getAllByText(/MEGALOVANIA|Only Theirs/).map((el) => el.closest("li") as HTMLElement);
  };

  it("줄에 `나`/`상대` 라벨과 달성률, RateDiffChip(−0.47%)이 있고 상대만 줄은 `내 기록 없음` 칩이다", async () => {
    showCharts();
    const [first, second] = await lines();
    expect(first).toHaveTextContent(/나\s*95\.63/);
    expect(first).toHaveTextContent(/상대\s*96\.10/);
    expect(first).toHaveTextContent(`${MINUS}0.47%`);
    expect(second).toHaveTextContent("내 기록 없음");
    expect(screen.getByText(/내 달성률 − 상대 달성률/)).toBeInTheDocument();
  });

  it("재킷은 켜졌고 이미지가 있을 때만 칸이 생긴다", async () => {
    const { unmount } = showCharts();
    const [off] = await lines();
    expect(off.querySelector(".size-12")).toBeNull();
    unmount();

    act(() => setJacketData({ enabled: true, jackets: { "3": "/jackets/3.webp" } }));
    showCharts();
    const [on] = await lines();
    expect(on.querySelector(".size-12")).not.toBeNull();
    expect(on.querySelector("img")).toHaveAttribute("src", "/jackets/3.webp");
  });

  it("승·무·패·상대만 탭은 줄바꿈 없이 한 줄(whitespace-nowrap)이다", async () => {
    showCharts();
    fireEvent.click(await screen.findByRole("button", { name: "곡별 승패" }));
    const group = await screen.findByRole("group", { name: "결과" });
    for (const b of within(group).getAllByRole("button")) expect(b).toHaveClass("whitespace-nowrap");
  });
});
