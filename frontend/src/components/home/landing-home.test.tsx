import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingNotices } from "@/components/home/LandingNotices";
import { LandingPlayers } from "@/components/home/LandingPlayers";
import { LandingTierShortcuts } from "@/components/home/LandingTierShortcuts";
import { LANDING_TIER_SHORTCUTS } from "@/lib/landing-home";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const page = <T,>(content: T[]) => ({ content, page: 0, size: content.length, totalElements: content.length, totalPages: 1 });
function player(id: number) {
  return {
    userId: id,
    rank: id,
    nickname: `유저${id}`,
    tier: { key: "GOLD", displayName: "Gold", minScore: 0, maxScore: 100 },
    totalScore: 1234.5 - id,
  };
}
function notice(id: number) {
  const at = "2026-11-01T00:00:00Z";
  return { id, title: `공지${id}`, content: "본문은 홈에 보이지 않는다", createdAt: at, updatedAt: at };
}

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function renderWith(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
}

describe("LandingPlayers (로그인 전 홈의 유저 상위 5)", () => {
  it("5명만 요청하고 목록 순서대로 최대 5줄을 그린다", async () => {
    fetchMock.mockResolvedValue(json(page([1, 2, 3, 4, 5, 6].map(player))));
    renderWith(<LandingPlayers />);
    expect(await screen.findByText("유저1")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/players");
    expect(String(fetchMock.mock.calls[0][0])).toContain("size=5");
    // 서버가 더 줘도 5줄까지만
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByText("유저6")).toBeNull();
    // 보는 사람이 없어 `나` 표시는 없고, 줄은 그 유저의 읽기 전용 상세로 간다
    expect(screen.queryByText("나")).toBeNull();
    expect(screen.getByRole("link", { name: /유저2/ })).toHaveAttribute("href", "/players/2");
    expect(screen.getByRole("link", { name: "전체 보기" })).toHaveAttribute("href", "/players");
  });

  it("공개 유저가 없으면 카드를 통째로 숨긴다 (안내 문구도 두지 않는다)", async () => {
    fetchMock.mockResolvedValue(json(page([])));
    const { container } = renderWith(<LandingPlayers />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("불러오는 중이거나 불러오지 못해도 카드를 숨긴다", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const loading = renderWith(<LandingPlayers />);
    expect(loading.container).toBeEmptyDOMElement();
    loading.unmount();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json({ code: "INTERNAL", message: "x", timestamp: "t" }, 500));
    const failed = renderWith(<LandingPlayers />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(failed.container).toBeEmptyDOMElement());
  });
});

describe("LandingNotices (로그인 전 홈의 최근 공지 3개)", () => {
  it("3건만 요청하고 최대 3줄을 제목·작성일로 그리며 본문은 보이지 않는다", async () => {
    fetchMock.mockResolvedValue(json(page([1, 2, 3, 4].map(notice))));
    renderWith(<LandingNotices />);
    expect(await screen.findByText("공지1")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/notices");
    expect(String(fetchMock.mock.calls[0][0])).toContain("size=3");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("공지4")).toBeNull();
    expect(screen.queryByText("본문은 홈에 보이지 않는다")).toBeNull();
    expect(screen.getByRole("link", { name: /공지2/ })).toHaveAttribute("href", "/notices/2");
    expect(screen.getByRole("link", { name: "전체 보기" })).toHaveAttribute("href", "/notices");
  });

  it("공지가 없거나 불러오지 못하면 카드를 숨긴다", async () => {
    fetchMock.mockResolvedValue(json(page([])));
    const empty = renderWith(<LandingNotices />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(empty.container).toBeEmptyDOMElement());
    empty.unmount();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json({ code: "INTERNAL", message: "x", timestamp: "t" }, 500));
    const failed = renderWith(<LandingNotices />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(failed.container).toBeEmptyDOMElement());
  });
});

describe("LandingTierShortcuts (서열표 바로가기)", () => {
  it("5.4 / 5.6 / 5.8 / 6.0 / 미정 다섯 개가 서열표 폴더 주소로 연결된다", () => {
    render(<LandingTierShortcuts />);
    const nav = screen.getByRole("region", { name: "서열표 바로가기" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["5.4", "5.6", "5.8", "6.0", "미정"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/table/folder/5.4",
      "/table/folder/5.6",
      "/table/folder/5.8",
      "/table/folder/6.0",
      "/table/folder/undecided",
    ]);
    expect(LANDING_TIER_SHORTCUTS).toEqual([5.4, 5.6, 5.8, 6.0, null]);
    // 데이터를 부르지 않는 고정 링크
    expect(fetchMock).not.toHaveBeenCalled();
    // 누르는 영역 44px
    for (const a of links) expect(a.className).toContain("min-h-11");
  });
});

describe("새 공개 경로 없음 (backend PublicReadPaths와 맞는지)", () => {
  /** PublicReadPaths.java의 Pattern.compile("...") 문자열을 읽어 JS 정규식으로 바꾼다. 서버의 공개 목록이 바뀌면 이 테스트가 먼저 알려 준다. */
  function publicPatterns(): RegExp[] {
    const src = readFileSync(
      resolve(__dirname, "../../../../backend/src/main/java/com/srpfreaks/backend/security/PublicReadPaths.java"),
      "utf8",
    );
    return [...src.matchAll(/Pattern\.compile\("([^"]+)"\)/g)].map((m) => new RegExp(m[1].replace(/\\\\/g, "\\")));
  }

  it("로그인 전 홈이 부르는 두 목록 경로(/players, /notices)는 공개 읽기 경로 목록 안에 있다", () => {
    const patterns = publicPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    for (const path of ["/api/v1/players", "/api/v1/notices"]) {
      expect(patterns.some((p) => p.test(path)), path).toBe(true);
    }
  });
});
