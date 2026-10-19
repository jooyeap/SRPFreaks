import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { clearAccessToken } from "@/lib/auth-token";
import ImportSettingsPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/settings/import" }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function login(role: "USER" | "ROOT") {
  return json({
    accessToken: "t",
    tokenType: "Bearer",
    expiresIn: 900,
    user: { id: 1, email: "a@example.com", nickname: null, role, createdAt: "2026-10-01T00:00:00Z" },
  });
}

describe("가져오기 설정 화면", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <ImportSettingsPage />
        </AuthProvider>
      </QueryClientProvider>,
    );

  it("모두에게 열기 전에는 일반 사용자에게 준비 중 안내만 보여 주고 토큰 화면은 보여 주지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(login("USER"));
    renderPage();
    expect(await screen.findByText("이 기능은 아직 준비 중입니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "토큰 발급" })).toBeNull();
  });

  it("ROOT에게는 준비 중 안내 대신 토큰 화면을 보여 준다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).endsWith("/auth/refresh") ? login("ROOT") : json({ issued: false })),
    );
    renderPage();
    expect(await screen.findByRole("button", { name: "토큰 발급" })).toBeInTheDocument();
    expect(screen.queryByText("이 기능은 아직 준비 중입니다.")).toBeNull();
  });
});
