import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import type {
  RivalCompareRatingResponse,
  RivalDetailRow,
  RivalPatternSummary,
  RivalSummaryDetailResponse,
  RivalSummaryResponse,
} from "@/lib/api-types";
import type { DashTab } from "@/lib/rival-dashboard";

const gold = { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" };
const MINUS = "−";

const rating: RivalCompareRatingResponse = {
  userId: 7, nickname: "Rumi", tier: gold, totalScore: 9516.42, myTier: gold, myTotalScore: 9204.32,
  counts: { win: 1, lose: 1, tie: 1, theirsOnly: 1 }, single: [], other: [],
};

function pattern(key: RivalPatternSummary["key"], label: string, over: Partial<RivalPatternSummary> = {}): RivalPatternSummary {
  return { pattern: label, key, wins: 0, ties: 0, losses: 0, scoreDiffSum: 0, closeCount: 0, sharedCount: 0, rateDiffAvg: null, ...over };
}
const PATTERNS: RivalPatternSummary[] = [
  pattern("SINGLE", "단일", { wins: 6, ties: 1, losses: 2, scoreDiffSum: 30.5, closeCount: 2, sharedCount: 9, rateDiffAvg: 1.8 }),
  pattern("COMPOUND", "복합", { wins: 1, losses: 0, scoreDiffSum: 4, closeCount: 5, sharedCount: 6, rateDiffAvg: 0.5 }),
  pattern("COMPOSITE_SINGLE", "복합(단일)", { wins: 4, ties: 1, losses: 5, scoreDiffSum: -18, closeCount: 2, sharedCount: 10, rateDiffAvg: -0.4 }),
  pattern("DOUBLE", "이중"),
  pattern("TRIPLE", "삼중", { wins: 0, ties: 2, losses: 3, scoreDiffSum: -42.67, closeCount: 0, sharedCount: 5, rateDiffAvg: -3.2 }),
];
function summaryOf(patterns: RivalPatternSummary[]): RivalSummaryResponse {
  return {
    userId: 7, nickname: "Rumi", closeMargin: 1,
    totals: { wins: 11, ties: 4, losses: 10, closeCount: 9, sharedCount: 30, scoreDiffSum: -26.17 }, patterns,
    tiers: [],
    distribution: patterns.map((p) => ({ pattern: p.pattern, key: p.key, diffs: [] })),
    rateDistribution: patterns.map((p) => ({ pattern: p.pattern, key: p.key, diffs: [] })),
  };
}

/** 곡 한 줄: diff 인자는 달성률 차(%p, rateDiff = myRate − rate)다. 점수 차(diff 필드)는 옛 필드라 0으로 둔다(95% 이상은 점수가 같다). */
function detailRow(id: number, rateDiff: number, pattern = "단일"): RivalDetailRow {
  return {
    songDifficultyId: id, songId: 100 + id, title: `Song ${id}`, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 5.4, pattern,
    rate: 95, stage: "SS", score: 240, myRate: Math.round((95 + rateDiff) * 100) / 100, myStage: "S", myScore: 240, diff: 0, rateDiff,
  };
}
/** 속성 키·필터마다 다른 곡을 돌려주는 가짜 상세 응답 */
const ROWS: Record<string, Record<string, RivalDetailRow[]>> = {
  SINGLE: { WIN: [detailRow(1, 5), detailRow(2, 9)], LOSE: [detailRow(3, -2)], CLOSE: [detailRow(4, 0.3)] },
  COMPOUND: { WIN: [detailRow(5, 4)], LOSE: [], CLOSE: [detailRow(6, -0.2), detailRow(7, 0.9)] },
  COMPOSITE_SINGLE: { WIN: [], LOSE: [detailRow(8, -7), detailRow(9, -1)], CLOSE: [detailRow(10, 0)] },
  TRIPLE: { WIN: [], LOSE: [detailRow(11, -12)], CLOSE: [] },
};
function detailOf(key: string, filter: string, size: number): RivalSummaryDetailResponse {
  const content = (ROWS[key]?.[filter] ?? []).slice(0, size);
  return {
    userId: 7, nickname: "Rumi", summary: PATTERNS.find((p) => p.key === key) ?? PATTERNS[0],
    filterCounts: { all: 0, lose: 0, close: 0, win: 0 },
    rows: { content, page: 0, size, totalElements: content.length, totalPages: 1 },
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

function show(patterns: RivalPatternSummary[] = PATTERNS, props: Partial<React.ComponentProps<typeof RivalCompareView>> = {}) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    const detail = /\/compare\/summary\/([A-Z_]+)$/.exec(url.pathname);
    if (detail) {
      return json(detailOf(detail[1], url.searchParams.get("filter") ?? "ALL", Number(url.searchParams.get("size") ?? 20)));
    }
    if (url.pathname.endsWith("/compare/summary")) return json(summaryOf(patterns));
    if (url.pathname.endsWith("/compare/rating")) return json(rating);
    if (url.pathname.endsWith("/setlist")) return json({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 30 });
    return json({}, 404);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RivalCompareView viewerId={1} targetId={7} {...props} />
    </QueryClientProvider>,
  );
}
const dashboard = () => screen.findByRole("region", { name: state.locale === "ja" ? "ライバルダッシュボード" : "라이벌 대시보드" });
const detailCalls = () => fetchMock.mock.calls.map((c) => new URL(String(c[0]), "http://localhost")).filter((u) => /\/compare\/summary\/[A-Z_]+$/.test(u.pathname));

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

describe("라이벌 대시보드 (D67, 6단계)", () => {
  it("머리에 총점 차(부호 글자)와 승 무 패를 보인다(속성별 합)", async () => {
    show();
    const box = await dashboard();
    expect(box).toHaveTextContent("총점 차");
    expect(box).toHaveTextContent(`${MINUS}312.10`);
    expect(box).toHaveTextContent("승 11 무 4 패 10");
  });

  it("요약 카드 3개가 우세·열세·접전 속성과 값(평균 달성률 차 % / 접전 곡 수)을 보이고 점수 차 합계는 보이지 않는다", async () => {
    show();
    const box = await dashboard();
    const cards = within(within(box).getByRole("group", { name: "요약" })).getAllByRole("button");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("우세 속성");
    expect(cards[0]).toHaveTextContent("단일");
    expect(cards[0]).toHaveTextContent("평균 달성률 차 +1.8%");
    expect(cards[0]).not.toHaveTextContent("+30.50");
    expect(cards[1]).toHaveTextContent("열세 속성");
    expect(cards[1]).toHaveTextContent("삼중");
    expect(cards[1]).toHaveTextContent("평균 달성률 차 −3.2%");
    expect(cards[1]).not.toHaveTextContent(`${MINUS}42.67`);
    expect(cards[2]).toHaveTextContent("접전(±1% 이내)");
    expect(cards[2]).toHaveTextContent("복합");
    expect(cards[2]).toHaveTextContent("접전 5곡");
    expect(cards[2]).not.toHaveTextContent("평균 달성률 차");
  });

  it("카드를 고르는 기준과 카드의 값이 같다(평균 달성률 차): 점수 차 합계가 커도 평균 달성률 차가 −인 속성은 우세 카드에 뽑히지 않는다(D67 개정)", async () => {
    // 단일: 점수 차 합계는 +50.00이지만 평균 달성률 차는 −0.4%. 복합: 합계 +10.00, 평균 달성률 차 +2.3%.
    show([
      pattern("SINGLE", "단일", { wins: 3, ties: 0, losses: 7, scoreDiffSum: 50, closeCount: 0, sharedCount: 10, rateDiffAvg: -0.4 }),
      pattern("COMPOUND", "복합", { wins: 8, ties: 0, losses: 2, scoreDiffSum: 10, closeCount: 0, sharedCount: 10, rateDiffAvg: 2.3 }),
      pattern("COMPOSITE_SINGLE", "복합(단일)"),
      pattern("DOUBLE", "이중"),
      pattern("TRIPLE", "삼중"),
    ]);
    const box = await dashboard();
    const [strongCard, weakCard] = within(within(box).getByRole("group", { name: "요약" })).getAllByRole("button");
    expect(strongCard).toHaveTextContent("복합");
    expect(strongCard).toHaveTextContent("평균 달성률 차 +2.3%");
    expect(strongCard).not.toHaveTextContent("단일");
    expect(weakCard).toHaveTextContent("단일");
    expect(weakCard).toHaveTextContent("평균 달성률 차 −0.4%");
  });

  it("평균 달성률 차는 부호가 글자로 보인다(+ / − / ±)와 공유 곡 0이면 `–`", async () => {
    show();
    const box = await dashboard();
    const rows = within(within(box).getByRole("list", { name: "속성별 승패" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("+1.8%");
    expect(rows[1]).toHaveTextContent("+0.5%");
    expect(rows[2]).toHaveTextContent("−0.4%");
    expect(rows[3]).not.toHaveTextContent("%"); // 이중 0곡
  });

  it("평균 달성률 차가 정확히 0.0이면 `±0.0%`로 보이고 우세·열세 탭에도 들지 않는다", async () => {
    show([pattern("SINGLE", "단일", { wins: 2, ties: 0, losses: 2, sharedCount: 4, rateDiffAvg: 0 }), pattern("COMPOUND", "복합"), pattern("COMPOSITE_SINGLE", "복합(단일)"), pattern("DOUBLE", "이중"), pattern("TRIPLE", "삼중")]);
    const box = await dashboard();
    const rows = within(within(box).getByRole("list", { name: "속성별 승패" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("±0.0%");
    const tabs = within(within(box).getByRole("group", { name: "속성별 상세" }));
    expect(tabs.getByRole("button", { name: "우세 0" })).toBeInTheDocument();
    expect(tabs.getByRole("button", { name: "열세 0" })).toBeInTheDocument();
  });

  it("판정 기준 안내 한 줄이 요약 영역 아래에 있다(승무패는 달성률, 총점은 레이팅 점수 기준)", async () => {
    show();
    const box = await dashboard();
    expect(within(box).getByText("승·무·패는 달성률로 비교합니다. 총점은 레이팅(점수) 기준이라 승수와 순서가 다를 수 있습니다.")).toBeInTheDocument();
  });

  it("한쪽만 기록한 곡은 속성 줄 아래 `상대만 N곡 · 나만 N곡`으로 보이고 0인 항은 생략된다. 둘 다 0이거나 옛 응답(필드 없음)이면 줄이 없다", async () => {
    show([
      pattern("SINGLE", "단일", { wins: 6, ties: 1, losses: 2, sharedCount: 9, rateDiffAvg: 1.8, onlyTheirs: 3, onlyMine: 2 }),
      pattern("COMPOUND", "복합", { wins: 1, sharedCount: 6, rateDiffAvg: 0.5, onlyTheirs: 4, onlyMine: 0 }),
      pattern("COMPOSITE_SINGLE", "복합(단일)", { wins: 1, sharedCount: 6, rateDiffAvg: 0.3, onlyTheirs: 0, onlyMine: 5 }),
      pattern("DOUBLE", "이중", { wins: 1, sharedCount: 6, rateDiffAvg: 0.2, onlyTheirs: 0, onlyMine: 0 }),
      pattern("TRIPLE", "삼중", { wins: 1, sharedCount: 6, rateDiffAvg: 0.1 }),   // 옛 응답: 필드 없음
    ]);
    const box = await dashboard();
    const detail = within(box).getByRole("region", { name: "속성별 상세" });
    const link = (name: string) => within(detail).getAllByRole("link").find((a) => a.getAttribute("href")?.startsWith("/players/") && a.textContent?.includes(name)) as HTMLElement;
    await waitFor(() => expect(link("단일")).toBeDefined());
    expect(link("단일")).toHaveTextContent("상대만 3곡 · 나만 2곡");
    expect(link("복합")).toHaveTextContent("상대만 4곡");
    expect(link("복합")).not.toHaveTextContent("나만");
    expect(link("복합(단일)")).toHaveTextContent("나만 5곡");
    expect(link("복합(단일)")).not.toHaveTextContent("상대만");
    expect(link("이중")).not.toHaveTextContent("상대만");
    expect(link("이중")).not.toHaveTextContent("나만");
    expect(link("삼중")).not.toHaveTextContent("상대만");
    expect(link("삼중")).not.toHaveTextContent("나만");
  });

  it("`%p`는 화면에 남지 않고 단위는 `%`만 나온다(2026-11-09)", async () => {
    show();
    const box = await dashboard();
    expect(box.textContent).not.toContain("%p");
    expect(box.textContent).toContain("%");
  });

  it("카드를 누르면 해당 탭으로 바뀌고 속성별 상세 구역으로 내려간다", async () => {
    const onTabChange = vi.fn<(tab: DashTab) => void>();
    show(PATTERNS, { tab: "strong", onTabChange });
    const box = await dashboard();
    fireEvent.click(within(within(box).getByRole("group", { name: "요약" })).getAllByRole("button")[1]);
    expect(onTabChange).toHaveBeenCalledWith("weak");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("탭 글자에 속성 수가 들어가고 누르면 탭이 바뀐다(주소 상태는 부모가 쥔다)", async () => {
    const onTabChange = vi.fn<(tab: DashTab) => void>();
    show(PATTERNS, { tab: "strong", onTabChange });
    const box = await dashboard();
    const tabs = within(within(box).getByRole("group", { name: "속성별 상세" }));
    expect(tabs.getByRole("button", { name: "우세 2" })).toHaveAttribute("aria-pressed", "true");
    expect(tabs.getByRole("button", { name: "열세 2" })).toBeInTheDocument();
    fireEvent.click(tabs.getByRole("button", { name: "접전 3" }));
    expect(onTabChange).toHaveBeenCalledWith("close");
  });

  it("탭을 주지 않으면 스스로 갖고, 탭마다 속성 줄이 정해진 순서로 나온다(우세=합계 큰 순, 열세=작은 순, 접전=접전 곡 많은 순)", async () => {
    show();
    const box = await dashboard();
    const detail = within(box).getByRole("region", { name: "속성별 상세" });
    // 곡 미리보기 링크(/songs/…)는 빼고 속성 줄 링크(/players/…)만 센다
    const names = () => within(detail).getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/players/")).map((a) => a.textContent ?? "");
    await waitFor(() => expect(names()[0]).toContain("단일"));
    expect(names()).toHaveLength(2);
    expect(names()[1]).toContain("복합");
    fireEvent.click(within(detail).getByRole("button", { name: "열세 2" }));
    expect(names()[0]).toContain("삼중");
    expect(names()[1]).toContain("복합(단일)");
    fireEvent.click(within(detail).getByRole("button", { name: "접전 3" }));
    expect(names()[0]).toContain("복합"); // 접전 5곡
    expect(names()).toHaveLength(3);
  });

  it("속성 줄은 이름·`승 N · 무 N · 패 N`·값(우세·열세 탭은 평균 달성률 차 %, 접전 탭은 접전 곡 수)과 카테고리 상세 링크를 가진다", async () => {
    show(PATTERNS, { tab: "strong" });
    const box = await dashboard();
    const detail = within(box).getByRole("region", { name: "속성별 상세" });
    const first = (await within(detail).findAllByRole("link"))[0];
    expect(first).toHaveAttribute("href", "/players/7/compare/SINGLE?from=strong");
    expect(first).toHaveTextContent("승 6 · 무 1 · 패 2");
    expect(first).toHaveTextContent("+1.8%");
    expect(first).toHaveTextContent("평균 달성률 차");
    expect(first).not.toHaveTextContent("+30.50");
  });

  it("접전 탭의 속성 줄 값은 접전 곡 수다", async () => {
    show(PATTERNS, { tab: "close" });
    const box = await dashboard();
    const detail = within(box).getByRole("region", { name: "속성별 상세" });
    const first = (await within(detail).findAllByRole("link"))[0];
    expect(first).toHaveAttribute("href", "/players/7/compare/COMPOUND?from=close");
    expect(first).toHaveTextContent("접전 5곡");
  });

  it("막대: 속성 다섯 줄이 항상 같은 순서로 나오고, 왼쪽 `패 N`·오른쪽 `승 N`·맨 오른쪽 평균 달성률 차가 글자로 있다", async () => {
    show();
    const box = await dashboard();
    const bars = within(box).getByRole("list", { name: "속성별 승패" });
    const rows = within(bars).getAllByRole("listitem");
    expect(rows.map((r) => r.getAttribute("data-key"))).toEqual(["SINGLE", "COMPOUND", "COMPOSITE_SINGLE", "DOUBLE", "TRIPLE"]);
    // 단일: 패 2 · 승 6 · +1.8%. 점수 차 합계(+30.50)는 보이지 않는다
    expect(rows[0]).toHaveTextContent("패 2");
    expect(rows[0]).toHaveTextContent("승 6");
    expect(rows[0]).toHaveTextContent("+1.8%");
    expect(rows[0]).not.toHaveTextContent("+30.50");
    // 복합(단일): −0.4%. 합계 −18.00은 보이지 않는다
    expect(rows[2]).toHaveTextContent("−0.4%");
    expect(rows[2]).not.toHaveTextContent(`${MINUS}18.00`);
    // 읽기 프로그램용 라벨 글자(숨김)가 값 앞에 붙는다
    expect(within(rows[0]).getByText("평균 달성률 차")).toHaveClass("sr-only");
    // 막대 글자는 줄바꿈하지 않고 최소 38px을 갖는다. 승 6이 가장 길다(100%), 패 5는 5/6
    const win = within(rows[0]).getByText("승 6");
    expect(win).toHaveClass("whitespace-nowrap", "min-w-[38px]");
    expect(win.style.width).toBe("100%");
    expect(within(rows[2]).getByText("패 5").style.width).toBe(`${(5 / 6) * 100}%`);
    // 승·패가 0인 쪽은 막대를 그리지 않는다(복합: 패 0)
    expect(within(rows[1]).queryByText(/^패/)).toBeNull();
  });

  it("공유 곡이 5곡 미만인 속성(0곡 포함)에 `※ 5곡 미만이라 참고용`을 보이고, 0곡은 값이 `–`다(0이 아니다)", async () => {
    show();
    const box = await dashboard();
    const rows = within(within(box).getByRole("list", { name: "속성별 승패" })).getAllByRole("listitem");
    expect(within(rows[0]).queryByText("※ 5곡 미만이라 참고용")).toBeNull(); // 9곡
    expect(within(rows[3]).getByText("※ 5곡 미만이라 참고용")).toBeInTheDocument(); // 이중 0곡
    expect(rows[3]).toHaveTextContent("–");
    expect(rows[3]).not.toHaveTextContent("%"); // 값 옆에 ※를 붙이지도, 0.0%를 쓰지도 않는다
    expect(within(rows[4]).queryByText("※ 5곡 미만이라 참고용")).toBeNull(); // 삼중 5곡
    // 아래 안내 한 줄(맨 오른쪽 숫자 = 평균 달성률 차)
    expect(within(box).getByText("막대: 왼쪽 패(열세) · 오른쪽 승(우세) · 오른쪽 숫자는 평균 달성률 차")).toBeInTheDocument();
  });

  it("차트 전환 칸에는 막대·점 분포·레이더가 보이고 기본은 막대다(7단계)", async () => {
    show();
    const box = await dashboard();
    const group = within(box).getByRole("group", { name: "차트" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["막대", "점 분포", "레이더"]);
    expect(within(group).getByRole("button", { name: "막대" })).toHaveAttribute("aria-pressed", "true");
  });

  it("미리보기: 우세 탭은 크게 앞선 곡 2곡을 속성마다 받아 합쳐 보이고 `담기`는 없다", async () => {
    show(PATTERNS, { tab: "strong" });
    const box = await dashboard();
    const preview = await within(box).findByRole("region", { name: "가장 크게 앞선 곡" });
    const items = await within(preview).findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Song 2"); // +9
    expect(items[1]).toHaveTextContent("Song 1"); // +5
    expect(within(preview).queryByRole("button")).toBeNull();
    // 탭에 든 속성(단일·복합)만, 필터·정렬·곡 수를 서버에 맡겼다
    const calls = detailCalls();
    expect(calls.map((u) => u.pathname.split("/").pop()).sort()).toEqual(["COMPOUND", "SINGLE"]);
    expect(calls.every((u) => u.searchParams.get("filter") === "WIN" && u.searchParams.get("sort") === "DIFF_DESC" && u.searchParams.get("size") === "2")).toBe(true);
  });

  it("미리보기: 열세 탭은 크게 뒤진 곡 2곡에 `담기`가 있고, 접전 탭은 가장 아슬아슬한 곡 3곡이다", async () => {
    show(PATTERNS, { tab: "weak" });
    let box = await dashboard();
    const weak = await within(box).findByRole("region", { name: "가장 크게 뒤진 곡" });
    const items = await within(weak).findAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([expect.stringContaining("Song 11"), expect.stringContaining("Song 8")]); // −12, −7
    // 칩은 달성률 차(내 83 − 상대 95 = −12.00%)이고, 곡을 고르는 순서도 같은 달성률 차(크게 뒤진 순)다(D67 개정)
    expect(within(items[0]).getByText(`${MINUS}12.00%`)).toBeInTheDocument();
    expect(within(items[1]).getByText(`${MINUS}7.00%`)).toBeInTheDocument();
    expect(await within(weak).findAllByRole("button", { name: /세트리스트에 담기$/ })).toHaveLength(2);
    cleanup();

    show(PATTERNS, { tab: "close" });
    box = await dashboard();
    const close = await within(box).findByRole("region", { name: "가장 아슬아슬한 곡" });
    const closeItems = await within(close).findAllByRole("listitem");
    expect(closeItems).toHaveLength(3);
    // |달성률 차| 작은 순: Song 10(0), 6(−0.2), 4(0.3)
    expect(closeItems.map((li) => /Song (\d+)/.exec(li.textContent ?? "")?.[1])).toEqual(["10", "6", "4"]);
  });

  it("탭에 든 속성이 없으면 안내만 보이고 미리보기를 요청하지 않는다(0곡)", async () => {
    show([pattern("SINGLE", "단일"), pattern("COMPOUND", "복합")], { tab: "strong" });
    const box = await dashboard();
    expect(within(box).getByText("해당하는 속성이 없습니다.")).toBeInTheDocument();
    expect(detailCalls()).toHaveLength(0);
    // 카드는 모두 `–`이고 눌리지 않는다
    for (const card of within(within(box).getByRole("group", { name: "요약" })).getAllByRole("button")) expect(card).toBeDisabled();
  });

  it("공유 곡이 1곡뿐인 속성도 깨지지 않고 참고용 표시가 붙는다", async () => {
    show([pattern("SINGLE", "단일", { wins: 1, scoreDiffSum: 2.5, sharedCount: 1, rateDiffAvg: 2.5 })], { tab: "strong" });
    const box = await dashboard();
    const detail = within(box).getByRole("region", { name: "속성별 상세" });
    const link = (await within(detail).findAllByRole("link"))[0];
    expect(link).toHaveTextContent("승 1 · 무 0 · 패 0");
    expect(link).toHaveTextContent("※ 5곡 미만이라 참고용");
  });

  it("집계를 받지 못하면 안내 문구를 보이고 아래 비교 화면은 그대로 쓸 수 있다", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/compare/summary")) return json({ code: "X", message: "집계를 불러오지 못했습니다." }, 500);
      if (url.includes("/compare/rating")) return json(rating);
      return json({}, 404);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RivalCompareView viewerId={1} targetId={7} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("집계를 불러오지 못했습니다.");
    expect(screen.getByRole("button", { name: "곡별 승패" })).toBeInTheDocument();
  });

  it("일본어: 優勢 / 劣勢 / 接戦, 総合点差, 属性別の詳細", async () => {
    state.locale = "ja";
    show(PATTERNS, { tab: "strong" });
    const box = await dashboard();
    expect(box).toHaveTextContent("総合点差");
    expect(box).toHaveTextContent("勝 11 分 4 敗 10");
    const cards = within(within(box).getByRole("group", { name: "サマリー" })).getAllByRole("button");
    expect(cards[0]).toHaveTextContent("優勢の属性");
    expect(cards[0]).toHaveTextContent("単色");
    expect(cards[0]).toHaveTextContent("平均達成率差 +1.8%");
    expect(cards[1]).toHaveTextContent("劣勢の属性");
    expect(cards[2]).toHaveTextContent("接戦（±1%以内）");
    const detail = within(box).getByRole("region", { name: "属性別の詳細" });
    expect(within(detail).getByRole("button", { name: "優勢 2" })).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "劣勢 2" })).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "接戦 3" })).toBeInTheDocument();
    expect(await within(box).findByRole("region", { name: "大きくリードしている曲" })).toBeInTheDocument();
    expect(within(box).getByRole("list", { name: "属性別の勝敗" })).toBeInTheDocument();
  });
});
