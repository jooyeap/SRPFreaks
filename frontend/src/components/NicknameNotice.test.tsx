import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { NicknameNotice } from "@/components/NicknameNotice";
import { clearAccessToken } from "@/lib/auth-token";

let pathname = "/table";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const authWith = (nickname: string | null) => ({
  accessToken: "t",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
});

describe("NicknameNotice", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    pathname = "/table";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderNotice = () =>
    render(
      <AuthProvider>
        <NicknameNotice />
      </AuthProvider>,
    );

  it("로그인했고 닉네임이 없으면 설정 안내를 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json(authWith(null)));
    renderNotice();
    expect(await screen.findByText(/닉네임을 설정해 주세요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "설정하기" })).toHaveAttribute("href", "/settings");
  });

  it("닉네임이 있으면 보이지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(json(authWith("たろう")));
    renderNotice();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText(/닉네임을 설정해 주세요/)).toBeNull();
  });

  it("설정 화면에서는 보이지 않는다", async () => {
    pathname = "/settings";
    fetchMock.mockResolvedValueOnce(json(authWith(null)));
    renderNotice();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText(/닉네임을 설정해 주세요/)).toBeNull();
  });

  it("로그인하지 않았으면 보이지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "AUTH_FAILED", message: "x" }, 401));
    renderNotice();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText(/닉네임을 설정해 주세요/)).toBeNull();
  });
});
