import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 전체 순위 주소(/songs/{곡 id}/ranking?chart=&page=)와 접근 규칙(로그인·잘못된 곡 id)을 확인한다. 라우터와 로그인 상태는 가짜로 끼운다.
const nav = vi.hoisted(() => ({
  params: { songId: "5" } as Record<string, string>,
  search: new URLSearchParams("chart=12"),
  replace: vi.fn<(href: string, options?: { scroll?: boolean }) => void>(),
  push: vi.fn<(href: string) => void>(),
  pathname: "/songs/5/ranking",
}));
vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  useSearchParams: () => nav.search,
  useRouter: () => ({ replace: nav.replace, push: nav.push, back: vi.fn() }),
  usePathname: () => nav.pathname,
}));
const auth = vi.hoisted(() => ({ value: { status: "authenticated", user: { id: 1 } } as { status: string; user: { id: number } | null } }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => auth.value, useOptionalUser: () => auth.value.user }));

import RankingPage from "@/app/songs/[songId]/ranking/page";

const song = {
  id: 5, title: "Test Song", artist: null, addedVersion: null, titleFolder: null, bpmMin: null, bpmMax: null, source: null, titles: [],
  difficulties: [{ id: 12, instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9.5, noteCount: null }],
};
const ranking = {
  songDifficultyId: 12, players: 45, page: 1, size: 20, totalPages: 3, me: null,
  items: [{ rank: 21, userId: 45, nickname: "nick45", achievementRate: 90, stage: "S", isMe: false }],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RankingPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  nav.params = { songId: "5" };
  nav.search = new URLSearchParams("chart=12");
  nav.replace.mockReset();
  nav.push.mockReset();
  auth.value = { status: "authenticated", user: { id: 1 } };
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/ranking")) return Promise.resolve(json(ranking));
    if (url.includes("/songs/5")) return Promise.resolve(json(song));
    return Promise.resolve(json({}, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const rankingCalls = () => fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.includes("/ranking"));

describe("전체 순위 화면 주소", () => {
  it("로그인한 사용자: 주소의 chart·page로 순위를 부르고 목록을 보인다", async () => {
    nav.search = new URLSearchParams("chart=12&page=1");
    renderPage();

    expect(await screen.findByText("nick45")).toBeInTheDocument();
    expect(rankingCalls()[0]).toContain("/difficulties/12/ranking");
    expect(rankingCalls()[0]).toContain("page=1");
  });

  it("쪽을 넘기면 chart는 그대로 두고 ?page=만 replace로 바꾼다(기록이 쌓이지 않는다, 스크롤 유지)", async () => {
    renderPage();
    await screen.findByText("nick45");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(nav.replace).toHaveBeenCalledWith("/songs/5/ranking?chart=12&page=1", { scroll: false });
  });

  it("첫 쪽으로 돌아가면 ?page가 주소에서 빠진다", async () => {
    nav.search = new URLSearchParams("chart=12&page=1");
    renderPage();
    await screen.findByText("nick45");

    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(nav.replace).toHaveBeenCalledWith("/songs/5/ranking?chart=12", { scroll: false });
  });

  it("page가 숫자가 아니거나 음수면 첫 쪽(0)으로 본다", async () => {
    nav.search = new URLSearchParams("chart=12&page=-3");
    renderPage();
    await screen.findByText("nick45");

    expect(rankingCalls()[0]).toContain("page=0");
  });

  it("비로그인에게는 로그인 안내만 보이고 순위·곡 API를 부르지 않는다", () => {
    auth.value = { status: "anonymous", user: null };
    renderPage();

    expect(screen.getByText("전체 순위는 로그인한 뒤에 볼 수 있습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("로그인 상태를 확인하는 동안에는 아무 API도 부르지 않는다", () => {
    auth.value = { status: "loading", user: null };
    renderPage();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("곡 id가 올바른 숫자가 아니면 곡을 찾을 수 없다고만 안내한다", async () => {
    nav.params = { songId: "abc" };
    renderPage();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("곡을 찾을 수 없습니다."));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
