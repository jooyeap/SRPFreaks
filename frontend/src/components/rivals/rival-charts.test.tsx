import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import { resetShowJacketsForTest, setJacketData } from "@/lib/jackets";

// 공용 setup은 한국어 번역만 끼우므로, 이 파일에서는 locale을 바꿔 가며 ko/ja를 모두 확인한다.
const state = vi.hoisted(() => ({ locale: "ko" as "ko" | "ja" }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    createTranslator({ locale: state.locale, messages: state.locale === "ja" ? ja : ko, namespace } as never),
  useLocale: () => state.locale,
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

import { RivalCompareView } from "@/components/rivals/RivalCompareView";
import { RivalDotChart } from "@/components/rivals/RivalDotChart";
import { RivalRadarChart } from "@/components/rivals/RivalRadarChart";
import type { RivalCompareRatingResponse, RivalPatternDiffs, RivalPatternSummary, RivalSummaryResponse } from "@/lib/api-types";
import type { DashChart } from "@/lib/rival-dashboard";

function pattern(key: RivalPatternSummary["key"], label: string, over: Partial<RivalPatternSummary> = {}): RivalPatternSummary {
  return { pattern: label, key, wins: 0, ties: 0, losses: 0, scoreDiffSum: 0, closeCount: 0, sharedCount: 0, ...over };
}
const PATTERNS: RivalPatternSummary[] = [
  pattern("SINGLE", "단일", { wins: 6, ties: 1, losses: 2, scoreDiffSum: 30.5, closeCount: 2, sharedCount: 9 }),
  pattern("COMPOUND", "복합", { wins: 1, losses: 0, scoreDiffSum: 4, closeCount: 3, sharedCount: 4 }),
  pattern("COMPOSITE_SINGLE", "복합(단일)", { wins: 4, ties: 1, losses: 5, scoreDiffSum: -18, closeCount: 2, sharedCount: 10 }),
  pattern("DOUBLE", "이중"),
  pattern("TRIPLE", "삼중", { wins: 0, ties: 2, losses: 3, scoreDiffSum: -42.67, closeCount: 0, sharedCount: 5 }),
];
const DISTRIBUTION: RivalPatternDiffs[] = [
  { pattern: "단일", key: "SINGLE", diffs: [-0.5, 0.2, 1, 2.5, 9, 14, 30] },
  { pattern: "복합", key: "COMPOUND", diffs: [0, 0.3, 4] },
  { pattern: "복합(단일)", key: "COMPOSITE_SINGLE", diffs: [-12, -7, -1, 0, 3] },
  { pattern: "이중", key: "DOUBLE", diffs: [] },
  { pattern: "삼중", key: "TRIPLE", diffs: [-20, -3, -2, 0, 0] },
];

afterEach(() => {
  cleanup();
  state.locale = "ko";
});

describe("점 분포 (D67, 7단계)", () => {
  it("role=img와 요약 설명, 숨김 표, 아래 안내를 가진다", () => {
    render(<RivalDotChart patterns={PATTERNS} distribution={DISTRIBUTION} closeMargin={1} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAccessibleName(/점 분포 차트/);
    expect(img.getAttribute("aria-label")).toContain("±1 이내는 접전");
    expect(screen.getByText("← 열세 · 접전 · 우세 →")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "속성별 승·무·패와 점수 차" });
    expect(table.parentElement).toHaveClass("sr-only"); // 감싼 상자가 숨긴다(표 자체에 주면 가로 스크롤이 생긴다)
    expect(within(table).getAllByRole("row")).toHaveLength(6); // 머리 + 속성 5줄
    expect(within(table).getByRole("row", { name: /^단일 / })).toHaveTextContent("+30.50");
  });

  it("곡 하나가 점 하나다(속성별 점 수 = 분포 길이)", () => {
    const { container } = render(<RivalDotChart patterns={PATTERNS} distribution={DISTRIBUTION} closeMargin={1} />);
    for (const d of DISTRIBUTION) {
      expect(container.querySelectorAll(`g[data-key="${d.key}"] circle`)).toHaveLength(d.diffs.length);
    }
  });

  it("점의 뜻은 위치와 함께 data-side로 나뉜다: 접전 ±1 안 / 우세 / 열세", () => {
    const { container } = render(<RivalDotChart patterns={PATTERNS} distribution={DISTRIBUTION} closeMargin={1} />);
    const sides = (key: string) => Array.from(container.querySelectorAll(`g[data-key="${key}"] circle`)).map((c) => c.getAttribute("data-side"));
    expect(sides("SINGLE")).toEqual(["close", "close", "close", "win", "win", "win", "win"]);
    expect(sides("TRIPLE")).toEqual(["lose", "lose", "lose", "close", "close"]);
    // 열세 점은 우세 점보다 왼쪽에 있다
    const xs = (key: string, side: string) =>
      Array.from(container.querySelectorAll(`g[data-key="${key}"] circle[data-side="${side}"]`)).map((c) => Number(c.getAttribute("cx")));
    expect(Math.max(...xs("COMPOSITE_SINGLE", "lose"))).toBeLessThan(Math.min(...xs("SINGLE", "win")));
  });

  it("±10을 넘는 점은 끝에 모으고 그 사실을 안내한다. 눈금 글자 −10 −5 0 +5 +10이 있다", () => {
    const { container } = render(<RivalDotChart patterns={PATTERNS} distribution={DISTRIBUTION} closeMargin={1} />);
    expect(screen.getByText("−10 ~ +10을 넘는 점은 양 끝에 모아 보여 줍니다.")).toBeInTheDocument();
    for (const tick of ["−10", "−5", "0", "+5", "+10"]) {
      expect(Array.from(container.querySelectorAll("text")).some((n) => n.textContent === tick)).toBe(true);
    }
    const cxs = Array.from(container.querySelectorAll('g[data-key="SINGLE"] circle')).map((c) => Number(c.getAttribute("cx")));
    expect(Math.max(...cxs)).toBe(76 + 232); // 14, 30은 +10 자리(오른쪽 끝)에 모인다
  });

  it("넘는 점이 없으면 끝에 모았다는 안내를 보이지 않는다", () => {
    render(<RivalDotChart patterns={PATTERNS} distribution={[{ pattern: "단일", key: "SINGLE", diffs: [1, -2] }]} closeMargin={1} />);
    expect(screen.queryByText(/양 끝에 모아/)).toBeNull();
  });

  it("공유 곡이 5곡 미만인 속성은 이름에 ※를 붙이고 안내를 보인다. 점이 없는 속성은 `–`", () => {
    const { container } = render(<RivalDotChart patterns={PATTERNS} distribution={DISTRIBUTION} closeMargin={1} />);
    expect(screen.getByText("※ 5곡 미만이라 참고용")).toBeInTheDocument();
    const labels = Array.from(container.querySelectorAll("text")).map((n) => n.textContent);
    expect(labels).toContain("복합 ※");
    expect(labels).toContain("이중 ※");
    expect(container.querySelectorAll('g[data-key="DOUBLE"] circle')).toHaveLength(0);
    expect(within(container.querySelector('g[data-key="DOUBLE"]') as unknown as HTMLElement).getByText("–")).toBeInTheDocument();
  });

  it("일본어: 안내·설명·표 글자가 일본어다", () => {
    state.locale = "ja";
    render(<RivalDotChart patterns={PATTERNS} distribution={DISTRIBUTION} closeMargin={1} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/点分布グラフ/);
    expect(screen.getByText("← 劣勢 · 接戦 · 優勢 →")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "属性別の勝・分・敗と点差" })).toBeInTheDocument();
    expect(screen.getByText("※ 5曲未満のため参考値")).toBeInTheDocument();
  });
});

describe("레이더 (D67, 7단계)", () => {
  it("role=img의 설명에 속성별 승률이 글자로 들어 있고 숨김 표가 있다", () => {
    render(<RivalRadarChart patterns={PATTERNS} />);
    const img = screen.getByRole("img");
    const label = img.getAttribute("aria-label") ?? "";
    expect(label).toContain("단일 67%");
    expect(label).toContain("복합 25%");
    expect(label).toContain("복합(단일) 40%");
    expect(label).toContain("이중 –");
    expect(label).toContain("삼중 0%");
    const table = screen.getByRole("table", { name: "속성별 승·무·패와 점수 차" });
    expect(within(table).getByRole("row", { name: /^단일 / })).toHaveTextContent("67%");
    expect(within(table).getByRole("row", { name: /^이중 / })).toHaveTextContent("–");
  });

  it("꼭짓점에 속성 이름과 승률(%)이 글자로 있다. 5곡 미만은 ※, 공유 곡 없음은 –", () => {
    const { container } = render(<RivalRadarChart patterns={PATTERNS} />);
    const texts = Array.from(container.querySelectorAll("text")).map((n) => n.textContent);
    expect(texts).toContain("단일");
    expect(texts).toContain("67%");
    expect(texts).toContain("25% ※");
    expect(texts).toContain("–");
    expect(texts).toContain("0%");
  });

  it("5곡 미만과 공유 곡 없음은 점을 비운 원이다. 충분한 속성은 채운 점", () => {
    const { container } = render(<RivalRadarChart patterns={PATTERNS} />);
    const hollow = (key: string) => container.querySelector(`circle[data-key="${key}"]`)?.getAttribute("data-hollow");
    expect(hollow("SINGLE")).toBe("false");
    expect(hollow("COMPOSITE_SINGLE")).toBe("false");
    expect(hollow("TRIPLE")).toBe("false");
    expect(hollow("COMPOUND")).toBe("true"); // 4곡
    expect(hollow("DOUBLE")).toBe("true"); // 0곡
    expect(screen.getByText("※ 5곡 미만이라 참고용")).toBeInTheDocument();
  });

  it("바깥 원(100%)과 점선(50%, 동률) 두 링과 범례가 있다", () => {
    const { container } = render(<RivalRadarChart patterns={PATTERNS} />);
    const rings = Array.from(container.querySelectorAll("polygon")).filter((p) => p.getAttribute("fill") === "none");
    expect(rings).toHaveLength(2);
    expect(rings[0].getAttribute("stroke-dasharray")).toBeNull();
    expect(rings[1].getAttribute("stroke-dasharray")).toBe("3 3");
    expect(screen.getByText(/바깥 원 100% · 점선 50\(?%?/)).toBeInTheDocument();
  });

  it("모든 속성이 5곡 이상이면 5곡 미만 안내가 없다", () => {
    render(<RivalRadarChart patterns={PATTERNS.map((p) => ({ ...p, sharedCount: 5, wins: 2 }))} />);
    expect(screen.queryByText(/5곡 미만/)).toBeNull();
  });

  it("일본어: 설명·범례가 일본어다", () => {
    state.locale = "ja";
    render(<RivalRadarChart patterns={PATTERNS} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/レーダーチャート/);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("単色 67%");
    expect(screen.getByText(/外側の円は100%/)).toBeInTheDocument();
  });
});

// ── 대시보드 안에서의 전환 ─────────────────────────────────────────────

const gold = { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" };
const rating: RivalCompareRatingResponse = {
  userId: 7, nickname: "Rumi", tier: gold, totalScore: 9516.42, myTier: gold, myTotalScore: 9204.32,
  counts: { win: 1, lose: 1, tie: 1, theirsOnly: 1 }, single: [], other: [],
};
const summary: RivalSummaryResponse = {
  userId: 7, nickname: "Rumi", closeMargin: 1,
  totals: { wins: 11, ties: 4, losses: 10, closeCount: 9, sharedCount: 30, scoreDiffSum: -26.17 },
  patterns: PATTERNS, tiers: [], distribution: DISTRIBUTION,
};
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

function show(chart?: DashChart, onChartChange?: (chart: DashChart) => void) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    if (/\/compare\/summary\/[A-Z_]+$/.test(url.pathname)) {
      return json({ userId: 7, nickname: "Rumi", summary: PATTERNS[0], filterCounts: { all: 0, lose: 0, close: 0, win: 0 }, rows: { content: [], page: 0, size: 2, totalElements: 0, totalPages: 1 } });
    }
    if (url.pathname.endsWith("/compare/summary")) return json(summary);
    if (url.pathname.endsWith("/compare/rating")) return json(rating);
    if (url.pathname.endsWith("/setlist")) return json({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 30 });
    return json({});
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RivalCompareView viewerId={1} targetId={7} chart={chart} onChartChange={onChartChange} />
    </QueryClientProvider>,
  );
}

describe("차트 전환 칸", () => {
  beforeEach(() => {
    state.locale = "ko";
    localStorage.clear();
    resetShowJacketsForTest();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    act(() => setJacketData(null));
  });

  it("`막대 | 점 분포 | 레이더` 세 버튼이 보이고 기본은 막대다", async () => {
    show();
    const box = await screen.findByRole("region", { name: "라이벌 대시보드" });
    const group = within(box).getByRole("group", { name: "차트" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["막대", "점 분포", "레이더"]);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(within(box).getByText(/막대: 왼쪽 패/)).toBeInTheDocument();
  });

  it("점 분포·레이더 버튼을 누르면 부모(주소)에 차트 값을 알린다", async () => {
    const onChange = vi.fn();
    show("bar", onChange);
    const box = await screen.findByRole("region", { name: "라이벌 대시보드" });
    fireEvent.click(within(box).getByRole("button", { name: "점 분포" }));
    fireEvent.click(within(box).getByRole("button", { name: "레이더" }));
    expect(onChange.mock.calls).toEqual([["dot"], ["radar"]]);
  });

  it("주소에서 온 차트 값대로 그림이 바뀐다(dot → 점 분포, radar → 레이더)", async () => {
    const first = show("dot");
    const box = await screen.findByRole("region", { name: "라이벌 대시보드" });
    expect(within(box).getByRole("img")).toHaveAccessibleName(/점 분포 차트/);
    expect(within(box).getByRole("button", { name: "점 분포" })).toHaveAttribute("aria-pressed", "true");
    first.unmount();
    show("radar");
    const box2 = await screen.findByRole("region", { name: "라이벌 대시보드" });
    expect(within(box2).getByRole("img")).toHaveAccessibleName(/레이더 차트/);
    expect(within(box2).queryByText(/막대: 왼쪽 패/)).toBeNull();
  });

  it("일본어에서도 세 버튼 글자가 일본어다", async () => {
    state.locale = "ja";
    show("radar");
    const box = await screen.findByRole("region", { name: "ライバルダッシュボード" });
    const group = within(box).getByRole("group", { name: "グラフ" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["棒", "点分布", "レーダー"]);
  });
});
