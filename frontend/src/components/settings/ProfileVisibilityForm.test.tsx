import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { ProfileVisibilityForm } from "@/components/settings/ProfileVisibilityForm";
import type { UserResponse } from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

const BASE: UserResponse = {
  id: 1,
  email: "a@example.com",
  nickname: "たろう",
  role: "USER",
  profilePublic: false,
  createdAt: "2026-10-01T00:00:00Z",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ProfileVisibilityForm", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input, init) => {
      if (String(input).endsWith("/auth/refresh")) {
        return Promise.resolve(json({ accessToken: "t", tokenType: "Bearer", expiresIn: 900, user: BASE }));
      }
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { profilePublic: boolean };
        return Promise.resolve(json({ ...BASE, profilePublic: body.profilePublic }));
      }
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderForm(user: UserResponse) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ProfileVisibilityForm user={user} />
        </AuthProvider>
      </QueryClientProvider>,
    );
  }
  const toggle = () => screen.getByRole("switch", { name: "유저 목록에 내 레이팅 공개" });
  const patchCalls = () => fetchMock.mock.calls.filter((c) => c[1]?.method === "PATCH");

  it("기본은 비공개이고 글자로도 `비공개`를 보여 준다", () => {
    renderForm(BASE);
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("비공개")).toBeInTheDocument();
  });

  it("켜면 공개 여부만 보내고(닉네임은 건드리지 않는다) 서버 응답으로 반영한다", async () => {
    renderForm(BASE);
    fireEvent.click(toggle());

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    const [url, init] = patchCalls()[0];
    expect(String(url)).toContain("/users/me/visibility");
    expect(JSON.parse(String(init?.body))).toEqual({ profilePublic: true }); // nickname 필드가 없어야 한다
  });

  it("공개 중이면 끌 수 있다", async () => {
    renderForm({ ...BASE, profilePublic: true });
    expect(toggle()).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle());

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ profilePublic: false });
  });

  it("닉네임이 없으면 켤 수 없고 안내한다", () => {
    renderForm({ ...BASE, nickname: null });
    expect(toggle()).toBeDisabled();
    expect(screen.getByText("닉네임을 먼저 설정해 주세요.")).toBeInTheDocument();
    fireEvent.click(toggle());
    expect(patchCalls()).toHaveLength(0);
  });

  it("서버가 거부하면 서버 문구를 보여 준다", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        init?.method === "PATCH"
          ? json({ code: "VALIDATION_ERROR", message: "요청 값을 확인해 주세요.", timestamp: "t" }, 400)
          : json({ accessToken: "t", tokenType: "Bearer", expiresIn: 900, user: BASE }),
      ),
    );
    renderForm(BASE);
    fireEvent.click(toggle());
    expect(await screen.findByRole("alert")).toHaveTextContent("요청 값을 확인해 주세요.");
  });
});
