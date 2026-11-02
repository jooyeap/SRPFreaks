import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { TierNotifyForm } from "@/components/settings/TierNotifyForm";
import type { UserResponse } from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

const BASE: UserResponse = {
  id: 1,
  email: "a@example.com",
  nickname: "たろう",
  role: "USER",
  profilePublic: false,
  rivalNotify: true,
  tierNotify: true,
  createdAt: "2026-10-01T00:00:00Z",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("TierNotifyForm", () => {
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
        const body = JSON.parse(String(init.body)) as { enabled: boolean };
        return Promise.resolve(json({ ...BASE, tierNotify: body.enabled }));
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
          <TierNotifyForm user={user} />
        </AuthProvider>
      </QueryClientProvider>,
    );
  }

  it("기본은 켜져 있고 글자로도 `받음`을 보여 준다", () => {
    renderForm(BASE);
    const toggle = screen.getByRole("switch", { name: "서열표 변경 알림 받기" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("받음")).toBeInTheDocument();
  });

  it("누르면 서열표 알림 설정 API로 끄기를 보낸다", async () => {
    renderForm(BASE);
    fireEvent.click(screen.getByRole("switch", { name: "서열표 변경 알림 받기" }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find((c) => c[1]?.method === "PATCH");
      expect(patch).toBeDefined();
      expect(String(patch?.[0])).toContain("/users/me/tier-notify");
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ enabled: false });
    });
  });
});
