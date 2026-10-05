import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { QueryCacheCleaner } from "@/components/QueryCacheCleaner";
import { setAuthLostHandler } from "@/lib/api";
import { clearAccessToken } from "@/lib/auth-token";
import TablePage from "@/app/table/page";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const AUTH = {
  accessToken: "t",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};

function LogoutButton() {
  const { logout } = useAuth();
  return <button onClick={() => void logout()}>logout</button>;
}

describe("QueryCacheCleaner", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setAuthLostHandler(null);
  });

  it("로그아웃하면 서버 데이터 캐시를 비운다", async () => {
    fetchMock.mockResolvedValueOnce(json(AUTH)); // 시작 복구
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })); // 로그아웃
    const client = new QueryClient();
    client.setQueryData(["secret"], { mine: "내 기록" });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <QueryCacheCleaner />
          <LogoutButton />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(client.getQueryData(["secret"])).toBeDefined()); // 로그인 중에는 유지
    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(client.getQueryData(["secret"])).toBeUndefined());
  });
});

describe("서열표 페이지", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("로그인하지 않았으면 로그인 안내만 보여 주고 서열표를 요청하지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ code: "AUTH_FAILED", message: "x" }, 401)); // 시작 복구 실패
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <TablePage />
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
    expect(fetchMock.mock.calls.every((c) => String(c[0]).includes("/auth/refresh"))).toBe(true);
  });
});
