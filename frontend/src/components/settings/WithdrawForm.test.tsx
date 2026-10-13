import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { WithdrawForm } from "@/components/settings/WithdrawForm";
import { clearAccessToken } from "@/lib/auth-token";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

const USER = { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" };
const AUTH = { accessToken: "t", tokenType: "Bearer", expiresIn: 900, user: USER };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("WithdrawForm", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let deleteResponse: () => Response;

  beforeEach(() => {
    clearAccessToken();
    replace.mockReset();
    fetchMock.mockReset();
    deleteResponse = () => new Response(null, { status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH)); // 시작 복구
      if (init?.method === "DELETE") return Promise.resolve(deleteResponse());
      if (url.endsWith("/auth/logout")) return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderForm() {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <WithdrawForm />
        </AuthProvider>
      </QueryClientProvider>,
    );
  }
  const deleteCalls = () => fetchMock.mock.calls.filter((c) => c[1]?.method === "DELETE");
  const withdrawButton = () => screen.getByRole("button", { name: /탈퇴/ });

  it("무엇이 지워지는지 보여 주고, 확인에 체크하기 전에는 탈퇴 버튼이 꺼져 있다", () => {
    renderForm();
    expect(screen.getByText("되돌릴 수 없습니다")).toBeInTheDocument();
    expect(screen.getByText(/입력한 모든 기록/)).toBeInTheDocument();
    expect(withdrawButton()).toBeDisabled();
    expect(screen.getByRole("link", { name: "취소" })).toHaveAttribute("href", "/settings");
  });

  it("체크하고 탈퇴하면 DELETE를 보내고 로그인 상태를 정리한 뒤 첫 화면으로 보낸다", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(withdrawButton()).toBeEnabled();
    fireEvent.click(withdrawButton());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(deleteCalls()).toHaveLength(1);
    expect(String(deleteCalls()[0][0])).toMatch(/\/users\/me$/);
  });

  it("서버가 거절하면 문구를 보여 주고 이동하지 않는다", async () => {
    deleteResponse = () => json({ code: "SERVER_ERROR", message: "잠시 후 다시 시도해 주세요." }, 500);
    renderForm();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(withdrawButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/다시 시도해 주세요/);
    expect(replace).not.toHaveBeenCalled();
  });
});
