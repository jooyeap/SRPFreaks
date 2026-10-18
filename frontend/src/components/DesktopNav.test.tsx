import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { DesktopNav, isActivePath } from "@/components/DesktopNav";
import { clearAccessToken } from "@/lib/auth-token";

let pathname = "/songs";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const authAs = (role: "USER" | "ADMIN") => ({
  accessToken: "t",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: "たろう", role, createdAt: "2026-10-01T00:00:00Z" },
});

describe("isActivePath", () => {
  it("홈은 정확히 같을 때만, 나머지는 하위 경로도 같은 메뉴로 본다", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/songs", "/")).toBe(false);
    expect(isActivePath("/songs", "/songs")).toBe(true);
    expect(isActivePath("/songs/12", "/songs")).toBe(true);
    // 접두사만 같은 다른 경로(/songsX)는 같은 메뉴가 아니다
    expect(isActivePath("/songsX", "/songs")).toBe(false);
  });
});

describe("DesktopNav", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    pathname = "/songs";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderNav = () =>
    render(
      <AuthProvider>
        <DesktopNav />
      </AuthProvider>,
    );

  it("시안 순서대로 링크가 있고 마이페이지가 맨 끝이다", () => {
    fetchMock.mockResolvedValue(json({}, 401));
    renderNav();
    const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
    const names = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names).toEqual(["홈", "곡 목록", "서열표", "유저", "공지", "건의", "설명서", "마이페이지"]);
    expect(within(nav).getByRole("link", { name: "홈" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "마이페이지" })).toHaveAttribute("href", "/me");
  });

  it("lg 미만에서는 숨기고(hidden) lg 이상에서만 보인다 (☰와 겹치지 않게)", () => {
    fetchMock.mockResolvedValue(json({}, 401));
    renderNav();
    const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(nav).toHaveClass("hidden");
    expect(nav).toHaveClass("lg:flex");
  });

  it("현재 화면 링크만 aria-current와 굵은 글자로 강조한다", () => {
    pathname = "/songs/12";
    fetchMock.mockResolvedValue(json({}, 401));
    renderNav();
    expect(screen.getByRole("link", { name: "곡 목록" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "곡 목록" })).toHaveClass("font-bold");
    expect(screen.getByRole("link", { name: "서열표" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
  });

  it("관리 링크는 USER에게 보이지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(json(authAs("USER")));
    renderNav();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: "관리" })).toBeNull();
  });

  it("관리 링크는 ADMIN에게 마이페이지 바로 앞에 보인다", async () => {
    fetchMock.mockResolvedValueOnce(json(authAs("ADMIN")));
    renderNav();
    expect(await screen.findByRole("link", { name: "관리" })).toHaveAttribute("href", "/admin");
    const names = screen
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names.slice(-2)).toEqual(["관리", "마이페이지"]);
  });
});
