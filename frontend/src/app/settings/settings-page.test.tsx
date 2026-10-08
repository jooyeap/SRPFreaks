import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { clearAccessToken } from "@/lib/auth-token";
import SettingsPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/settings" }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("설정 화면", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <SettingsPage />
        </AuthProvider>
      </QueryClientProvider>,
    );

  it("로그인했으면 계정 정보, 닉네임, 로그아웃, 탈퇴 화면으로 가는 링크를 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        accessToken: "t",
        tokenType: "Bearer",
        expiresIn: 900,
        user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
      }),
    );
    renderPage();
    expect(await screen.findByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByLabelText("닉네임")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "탈퇴하기" })).toHaveAttribute("href", "/settings/withdraw");
  });

  it("로그인하지 않았으면 로그인 링크만 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, 401));
    renderPage();
    expect(await screen.findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "탈퇴하기" })).toBeNull();
  });

  it("ROOT에게만 관리 화면 링크를 보여 준다", async () => {
    const login = (role: string) =>
      fetchMock.mockResolvedValueOnce(
        json({
          accessToken: "t",
          tokenType: "Bearer",
          expiresIn: 900,
          user: { id: 1, email: "a@example.com", nickname: null, role, createdAt: "2026-10-01T00:00:00Z" },
        }),
      );
    login("ROOT");
    const { unmount } = renderPage();
    expect(await screen.findByRole("link", { name: "관리 화면" })).toHaveAttribute("href", "/admin");
    unmount();

    clearAccessToken();
    login("ADMIN");
    renderPage();
    await screen.findByText("a@example.com");
    expect(screen.queryByRole("link", { name: "관리 화면" })).toBeNull();
  });
});
