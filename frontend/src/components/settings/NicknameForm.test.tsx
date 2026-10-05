import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { NicknameForm } from "@/components/settings/NicknameForm";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

const USER = { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" };
const AUTH = { accessToken: "t", tokenType: "Bearer", expiresIn: 900, user: USER };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("NicknameForm", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input, init) => {
      if (String(input).endsWith("/auth/refresh")) return Promise.resolve(json(AUTH)); // 시작 복구
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { nickname: string | null };
        return Promise.resolve(json({ ...USER, nickname: body.nickname }));
      }
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderForm(initial: string | null = null) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <NicknameForm initialNickname={initial} />
        </AuthProvider>
      </QueryClientProvider>,
    );
  }
  const input = () => screen.getByLabelText("닉네임");
  const patchCalls = () => fetchMock.mock.calls.filter((c) => c[1]?.method === "PATCH");

  it("규칙에 어긋나면 서버에 보내지 않고 문구를 보여 준다", async () => {
    renderForm();
    fireEvent.change(input(), { target: { value: "닉네임" } }); // 한글
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText(/영문, 숫자, 일본어/, { selector: "[role=alert]" })).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);

    fireEvent.change(input(), { target: { value: "a" } }); // 1자
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("닉네임은 2자 이상 12자 이하여야 합니다.")).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it("저장하면 정규화한 값으로 PATCH /users/me를 보내고 입력칸도 그 값으로 맞춘다", async () => {
    renderForm();
    fireEvent.change(input(), { target: { value: " ﾀﾛｳ " } }); // 반각 가타카나 + 공백
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("status")).toHaveTextContent("저장했습니다.");
    const [url, init] = patchCalls()[0];
    expect(url).toBe("/api/v1/users/me");
    expect(JSON.parse(String(init?.body))).toEqual({ nickname: "タロウ" });
    expect(input()).toHaveValue("タロウ");
  });

  it("비워서 저장하면 null(닉네임 없음)을 보낸다", async () => {
    renderForm("たろう");
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ nickname: null });
  });

  it("서버 오류는 서버 문구를 그대로 보여 준다", async () => {
    fetchMock.mockImplementation((input, init) => {
      if (String(input).endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
      if (init?.method === "PATCH") {
        return Promise.resolve(json({ code: "VALIDATION_ERROR", message: "요청 값을 확인해 주세요.", timestamp: "t" }, 400));
      }
      return Promise.resolve(json({}, 404));
    });
    renderForm();
    fireEvent.change(input(), { target: { value: "たろう" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("요청 값을 확인해 주세요.")).toBeInTheDocument();
  });
});
