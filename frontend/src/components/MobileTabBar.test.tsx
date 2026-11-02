import { fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { clearAccessToken } from "@/lib/auth-token";
import { SONG_TAB_KEY, resetSongTabForTest } from "@/lib/song-tab";
import { MobileTabBar } from "@/components/MobileTabBar";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

const fetchMock = vi.fn<typeof fetch>();
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const authAs = (role: "USER" | "ADMIN") => ({
  accessToken: "t",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: "たろう", role, profilePublic: false, rivalNotify: true, tierNotify: true, createdAt: "2026-10-01T00:00:00Z" },
});

// 더보기 시트의 관리·로그인/로그아웃 줄이 로그인 상태를 읽으므로 AuthProvider 안에서 그린다
function render(ui: ReactElement) {
  return rtlRender(<AuthProvider>{ui}</AuthProvider>);
}

describe("MobileTabBar", () => {
  beforeEach(() => {
    pathname = "/";
    clearAccessToken();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json({}, 401)); // 기본은 로그인 전
    vi.stubGlobal("fetch", fetchMock);
    localStorage.removeItem(SONG_TAB_KEY);
    resetSongTabForTest();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("홈 · 곡 · 마이 링크와 더보기 버튼이 순서대로 있다", () => {
    render(<MobileTabBar />);
    const nav = screen.getByRole("navigation", { name: "하단 메뉴" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/table", "/me"]);
    expect(links.map((link) => link.textContent)).toEqual(["홈", "곡", "마이"]);
    expect(within(nav).getByRole("link", { name: "마이페이지" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "더보기" })).toHaveAttribute("aria-expanded", "false");
  });

  it("lg 이상에서는 숨기고(lg:hidden) 화면 아래에 고정된다", () => {
    render(<MobileTabBar />);
    const nav = screen.getByRole("navigation", { name: "하단 메뉴" });
    expect(nav).toHaveClass("fixed", "bottom-0", "lg:hidden");
  });

  it("아이콘은 장식이라 화면 읽기 프로그램에 숨긴다", () => {
    render(<MobileTabBar />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("서열표 화면에서 곡 탭만 aria-current와 굵은 글자로 강조한다", () => {
    pathname = "/table/6.7";
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "곡" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "곡" })).toHaveClass("font-bold");
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
  });

  it("곡 목록·곡 상세 화면에서도 곡 탭이 강조된다", () => {
    pathname = "/songs/12";
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "곡" })).toHaveAttribute("aria-current", "page");
  });

  it("홈 탭은 홈에서만 강조된다", () => {
    pathname = "/songs";
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
  });

  it("더보기를 누르면 시트가 열리고 가져오기·공지·유저·건의·설명서·설정 링크가 보인다", () => {
    render(<MobileTabBar />);
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "더보기" }));

    const sheet = screen.getByRole("region", { name: "더보기" });
    const links = within(sheet).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/import",
      "/notices",
      "/players",
      "/suggestions",
      "/guide",
      "/settings",
    ]);
    expect(within(sheet).getByText("추천")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "더보기" })).toHaveAttribute("aria-expanded", "true");
  });

  it("시트는 Esc, 바깥 누르기, 링크 누르기, 더보기 다시 누르기로 닫힌다", () => {
    const { container } = render(<MobileTabBar />);
    const more = () => screen.getByRole("button", { name: "더보기" });

    fireEvent.click(more());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();

    fireEvent.click(more());
    fireEvent.click(container.querySelector("[aria-hidden='true'].bg-black\\/55") as Element);
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();

    fireEvent.click(more());
    fireEvent.click(screen.getByRole("link", { name: "공지" }));
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();

    fireEvent.click(more());
    fireEvent.click(more());
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();
  });

  it("곡 탭은 마지막으로 본 탭(곡 목록)으로 들어간다", () => {
    localStorage.setItem(SONG_TAB_KEY, "songs");
    resetSongTabForTest();
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "곡" })).toHaveAttribute("href", "/songs");
  });

  it("로그인 전에는 시트에 로그인 링크가 있고 관리·로그아웃은 없다", async () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "더보기" }));
    const sheet = screen.getByRole("region", { name: "더보기" });
    expect(await within(sheet).findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
    expect(within(sheet).queryByRole("link", { name: "관리" })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "로그아웃" })).toBeNull();
  });

  it("USER는 시트에 로그아웃만 보이고 관리는 보이지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(json(authAs("USER")));
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "더보기" }));
    const sheet = screen.getByRole("region", { name: "더보기" });
    expect(await within(sheet).findByRole("button", { name: "로그아웃" })).toBeInTheDocument();
    expect(within(sheet).queryByRole("link", { name: "관리" })).toBeNull();
  });

  it("ADMIN은 시트에서 관리 링크를 보고, 누르면 시트가 닫힌다", async () => {
    fetchMock.mockResolvedValueOnce(json(authAs("ADMIN")));
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "더보기" }));
    const admin = await screen.findByRole("link", { name: "관리" });
    expect(admin).toHaveAttribute("href", "/admin");
    fireEvent.click(admin);
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();
  });

  it("로그아웃을 누르면 시트가 닫히고 로그아웃을 요청한다", async () => {
    fetchMock.mockResolvedValueOnce(json(authAs("USER")));
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "더보기" }));
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/auth/logout"))).toBe(true));
  });
});
