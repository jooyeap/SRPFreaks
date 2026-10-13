import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { ImportTokenPanel } from "@/components/settings/ImportTokenPanel";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const USER = { id: 1, email: "a@example.com", nickname: null, role: "USER", profilePublic: false, createdAt: "2026-10-01T00:00:00Z" };

describe("ImportTokenPanel", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let status: { exists: boolean; createdAt: string | null; lastUsedAt: string | null };

  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    status = { exists: false, createdAt: null, lastUsedAt: null };
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return Promise.resolve(json({ accessToken: "t", tokenType: "Bearer", expiresIn: 900, user: USER }));
      }
      if (url.endsWith("/import-token")) {
        if (init?.method === "POST") {
          status = { exists: true, createdAt: "2026-10-13T00:00:00Z", lastUsedAt: null };
          return Promise.resolve(json({ token: "srpi_secret", createdAt: "2026-10-13T00:00:00Z" }, 201));
        }
        if (init?.method === "DELETE") {
          status = { exists: false, createdAt: null, lastUsedAt: null };
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(json(status));
      }
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ImportTokenPanel userId={1} />
        </AuthProvider>
      </QueryClientProvider>,
    );
  }
  const calls = (method: string) => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/import-token") && c[1]?.method === method);

  it("토큰이 없으면 발급 버튼만 보여 준다", async () => {
    renderPanel();
    expect(await screen.findByText("발급된 토큰이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "토큰 발급" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "폐기" })).toBeNull();
  });

  it("발급하면 토큰을 한 번 보여 주고 상태가 발급됨으로 바뀐다", async () => {
    renderPanel();
    await screen.findByText("발급된 토큰이 없습니다."); // 상태를 불러오는 동안은 발급 버튼이 막혀 있다
    fireEvent.click(screen.getByRole("button", { name: "토큰 발급" }));

    expect(await screen.findByLabelText("발급된 토큰")).toHaveTextContent("srpi_secret");
    expect(await screen.findByText("발급됨")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 발급" })).toBeInTheDocument();
    expect(calls("POST")).toHaveLength(1);
  });

  it("토큰을 브라우저 저장소에 넣지 않는다", async () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    renderPanel();
    await screen.findByText("발급된 토큰이 없습니다."); // 상태를 불러오는 동안은 발급 버튼이 막혀 있다
    fireEvent.click(screen.getByRole("button", { name: "토큰 발급" }));
    await screen.findByLabelText("발급된 토큰");
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });

  it("폐기는 확인 뒤에만 요청하고 토큰 표시를 지운다", async () => {
    status = { exists: true, createdAt: "2026-10-12T00:00:00Z", lastUsedAt: null };
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "폐기" }));
    expect(calls("DELETE")).toHaveLength(0);

    fireEvent.click(screen.getAllByRole("button", { name: "폐기" }).at(-1)!);
    await waitFor(() => expect(calls("DELETE")).toHaveLength(1));
    expect(await screen.findByText("발급된 토큰이 없습니다.")).toBeInTheDocument();
  });

  it("마지막 사용 시각이 없으면 `사용 기록 없음`으로 보여 준다", async () => {
    status = { exists: true, createdAt: "2026-10-12T00:00:00Z", lastUsedAt: null };
    renderPanel();
    expect(await screen.findByText("사용 기록 없음")).toBeInTheDocument();
  });
});
