import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 주소 상태(?tab=&chart=, ?filter=&page=&from=)와 접근 규칙(로그인·잘못된 id·허용 밖 속성 키)을 확인한다.
// 라우터와 로그인 상태는 가짜로 끼운다.
const nav = vi.hoisted(() => ({
  params: { userId: "7", key: "TRIPLE" } as Record<string, string>,
  search: new URLSearchParams(),
  replace: vi.fn<(href: string, options?: { scroll?: boolean }) => void>(),
  push: vi.fn<(href: string) => void>(),
  pathname: "/players/7/compare",
}));
vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  useSearchParams: () => nav.search,
  useRouter: () => ({ replace: nav.replace, push: nav.push, back: vi.fn() }),
  usePathname: () => nav.pathname,
}));
const auth = vi.hoisted(() => ({ value: { status: "authenticated", user: { id: 1 } } as { status: string; user: { id: number } | null } }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => auth.value, useOptionalUser: () => auth.value.user }));

import { resetAppHistoryForTest } from "@/lib/app-history";
import ComparePage from "@/app/players/[userId]/compare/page";
import CompareDetailPage from "@/app/players/[userId]/compare/[key]/page";
import type { RivalCompareRatingResponse, RivalSummaryResponse } from "@/lib/api-types";

const gold = { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" };
const rating: RivalCompareRatingResponse = {
  userId: 7, nickname: "Rumi", tier: gold, totalScore: 100, myTier: gold, myTotalScore: 90,
  counts: { win: 0, lose: 0, tie: 0, theirsOnly: 0 }, single: [], other: [],
};
const summary: RivalSummaryResponse = {
  userId: 7, nickname: "Rumi", closeMargin: 1,
  totals: { wins: 3, ties: 0, losses: 3, closeCount: 1, sharedCount: 6, scoreDiffSum: 0 },
  patterns: [
    { pattern: "단일", key: "SINGLE", wins: 3, ties: 0, losses: 0, scoreDiffSum: 9, closeCount: 1, sharedCount: 3 },
    { pattern: "삼중", key: "TRIPLE", wins: 0, ties: 0, losses: 3, scoreDiffSum: -9, closeCount: 0, sharedCount: 3 },
  ],
  tiers: [],
  distribution: [],
};
const detail = {
  userId: 7, nickname: "Rumi", summary: summary.patterns[1], filterCounts: { all: 3, lose: 3, close: 0, win: 0 },
  rows: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

function renderPage(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
}

beforeEach(() => {
  nav.params = { userId: "7", key: "TRIPLE" };
  nav.search = new URLSearchParams();
  nav.replace.mockReset();
  nav.push.mockReset();
  auth.value = { status: "authenticated", user: { id: 1 } };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    if (/\/compare\/summary\/[A-Z_]+$/.test(url.pathname)) return json(detail);
    if (url.pathname.endsWith("/compare/summary")) return json(summary);
    if (url.pathname.endsWith("/compare/rating")) return json(rating);
    if (url.pathname.endsWith("/setlist")) return json({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 30 });
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn();
});

describe("/players/{id}/compare 주소 상태", () => {
  it("주소의 `?tab=weak`로 열세 탭이 열린 채 시작한다", async () => {
    nav.search = new URLSearchParams("tab=weak&chart=bar");
    renderPage(<ComparePage />);
    const box = await screen.findByRole("region", { name: "라이벌 대시보드" });
    expect(within(box).getByRole("button", { name: "열세 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("탭을 누르면 다른 쿼리는 그대로 두고 `tab`만 바꿔 replace한다(기록을 쌓지 않고 맨 위로 올라가지 않는다)", async () => {
    nav.search = new URLSearchParams("view=charts&chart=bar");
    renderPage(<ComparePage />);
    const box = await screen.findByRole("region", { name: "라이벌 대시보드" });
    fireEvent.click(within(box).getByRole("button", { name: "열세 1" }));
    expect(nav.replace).toHaveBeenCalledTimes(1);
    const [href, options] = nav.replace.mock.calls[0];
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/players/7/compare");
    expect(url.searchParams.get("tab")).toBe("weak");
    expect(url.searchParams.get("view")).toBe("charts");
    expect(url.searchParams.get("chart")).toBe("bar");
    expect(options).toEqual({ scroll: false });
  });

  it("주소의 `?chart=radar`로 레이더가 열린 채 시작하고, 모르는 차트 값은 막대로 본다", async () => {
    nav.search = new URLSearchParams("chart=radar");
    const first = renderPage(<ComparePage />);
    const box = await screen.findByRole("region", { name: "라이벌 대시보드" });
    expect(within(box).getByRole("img")).toHaveAccessibleName(/레이더 차트/);
    expect(within(box).getByRole("button", { name: "레이더" })).toHaveAttribute("aria-pressed", "true");
    first.unmount();
    nav.search = new URLSearchParams("chart=zzz");
    renderPage(<ComparePage />);
    const box2 = await screen.findByRole("region", { name: "라이벌 대시보드" });
    expect(within(box2).getByRole("button", { name: "막대" })).toHaveAttribute("aria-pressed", "true");
  });

  it("점 분포 버튼을 누르면 다른 쿼리는 그대로 두고 `chart=dot`만 바꿔 replace한다", async () => {
    nav.search = new URLSearchParams("tab=weak&chart=bar");
    renderPage(<ComparePage />);
    const box = await screen.findByRole("region", { name: "라이벌 대시보드" });
    fireEvent.click(within(box).getByRole("button", { name: "점 분포" }));
    expect(nav.replace).toHaveBeenCalledTimes(1);
    const [href, options] = nav.replace.mock.calls[0];
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.get("chart")).toBe("dot");
    expect(url.searchParams.get("tab")).toBe("weak");
    expect(options).toEqual({ scroll: false });
  });

  it("모르는 탭 값은 우세로 본다", async () => {
    nav.search = new URLSearchParams("tab=zzz");
    renderPage(<ComparePage />);
    const box = await screen.findByRole("region", { name: "라이벌 대시보드" });
    expect(within(box).getByRole("button", { name: "우세 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("나 자신이거나 숫자가 아닌 id는 찾을 수 없다고 안내한다", async () => {
    nav.params = { userId: "1" };
    renderPage(<ComparePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("찾을 수 없");
  });

  it("로그인하지 않았으면 로그인 안내를 보인다", async () => {
    auth.value = { status: "anonymous", user: null };
    renderPage(<ComparePage />);
    expect(await screen.findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });
});

describe("/players/{id}/compare/{속성 키} 주소 상태", () => {
  it("주소의 필터·쪽·from을 읽어 서버에 보내고, 뒤로 가기에 탭을 싣는다", async () => {
    nav.pathname = "/players/7/compare/TRIPLE";
    nav.search = new URLSearchParams("filter=lose&page=2&from=weak");
    renderPage(<CompareDetailPage />);
    expect(await screen.findByRole("heading", { name: "삼중 · Rumi와 비교" })).toBeInTheDocument();
    const call = fetchMock.mock.calls.map((c) => new URL(String(c[0]), "http://localhost")).find((u) => u.pathname.endsWith("/summary/TRIPLE"));
    expect(call?.searchParams.get("filter")).toBe("LOSE");
    expect(call?.searchParams.get("page")).toBe("2");
    expect(screen.getByRole("link", { name: "라이벌 비교로" })).toHaveAttribute("href", "/players/7/compare?tab=weak");
  });

  it("칩을 누르면 `filter`를 바꾸고 쪽은 처음으로 돌려 replace한다", async () => {
    nav.pathname = "/players/7/compare/TRIPLE";
    nav.search = new URLSearchParams("filter=lose&page=2&from=weak");
    renderPage(<CompareDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "전체 3" }));
    const [href, options] = nav.replace.mock.calls[0];
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.get("filter")).toBe("all");
    expect(url.searchParams.has("page")).toBe(false);
    expect(url.searchParams.get("from")).toBe("weak");
    expect(options).toEqual({ scroll: false });
  });

  it("소문자 속성 키도 받는다(주소를 손으로 쳐도 열린다)", async () => {
    nav.params = { userId: "7", key: "triple" };
    renderPage(<CompareDetailPage />);
    expect(await screen.findByRole("heading", { name: /삼중/ })).toBeInTheDocument();
  });

  it("허용 밖의 속성 키·나 자신은 서버를 부르지 않고 찾을 수 없다고 안내한다", async () => {
    nav.params = { userId: "7", key: "EXCLUDED" };
    renderPage(<CompareDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("찾을 수 없");
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});


// 뒤로 가기(D67 개정): 들어온 화면으로 돌아가고, 탭·차트 전환은 history를 쌓지 않는다.
describe("/players/{id}/compare 뒤로 가기", () => {
  let back: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetAppHistoryForTest();
    back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
  });
  afterEach(() => {
    back.mockRestore();
    Reflect.deleteProperty(window, "navigation");
  });

  it("같은 사이트 안에서 들어왔으면 뒤로 버튼이 history 한 칸 뒤로 간다(들어온 화면으로)", async () => {
    Object.defineProperty(window, "navigation", { value: { canGoBack: true }, configurable: true, writable: true });
    renderPage(<ComparePage />);
    const link = await screen.findByRole("link", { name: "유저 상세로" });
    expect(fireEvent.click(link)).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("직접 들어왔으면(되돌아갈 칸이 없음) 뒤로 버튼이 `/players/{id}`로 간다", async () => {
    Object.defineProperty(window, "navigation", { value: { canGoBack: false }, configurable: true, writable: true });
    renderPage(<ComparePage />);
    const link = await screen.findByRole("link", { name: "유저 상세로" });
    expect(link).toHaveAttribute("href", "/players/7");
    expect(fireEvent.click(link)).toBe(true);
    expect(back).not.toHaveBeenCalled();
  });

  it("탭·차트를 바꿔도 push로 기록을 쌓지 않고(replace만), 그 뒤에도 뒤로 버튼은 비교 화면 이전 화면으로 간다", async () => {
    Object.defineProperty(window, "navigation", { value: { canGoBack: true }, configurable: true, writable: true });
    nav.search = new URLSearchParams("chart=bar");
    renderPage(<ComparePage />);
    const box = await screen.findByRole("region", { name: "라이벌 대시보드" });
    fireEvent.click(within(box).getByRole("button", { name: "열세 1" }));
    fireEvent.click(within(box).getByRole("button", { name: "점 분포" }));
    expect(nav.replace).toHaveBeenCalledTimes(2);
    expect(nav.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "유저 상세로" }));
    expect(back).toHaveBeenCalledTimes(1); // 한 칸만 뒤로: 탭·차트 상태가 history에 없으니 곧바로 들어온 화면이다
  });
});
