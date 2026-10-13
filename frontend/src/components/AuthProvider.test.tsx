import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { AuthControls } from "@/components/AuthControls";
import { apiFetch, setAuthLostHandler } from "@/lib/api";
import type { AuthResponse } from "@/lib/api-types";
import { clearAccessToken, getAccessToken } from "@/lib/auth-token";
import { loadGoogleIdentity } from "@/lib/google";

// 실제 구글 스크립트를 불러오지 않도록 가짜로 바꾼다
const disableAutoSelect = vi.fn();
vi.mock("@/lib/google", () => ({
  loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect })),
}));

const AUTH: AuthResponse = {
  accessToken: "access-1",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: "tester", role: "USER", profilePublic: false, createdAt: "2026-10-01T00:00:00Z" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function Probe() {
  const { status, user, loginWithGoogle } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.email ?? "-"}</span>
      <button onClick={() => void loginWithGoogle("google-id-token")}>login</button>
    </div>
  );
}

describe("AuthProvider", () => {
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

  it("시작할 때 Refresh 쿠키로 복구에 성공하면 로그인 상태가 된다", async () => {
    fetchMock.mockResolvedValueOnce(json(AUTH));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("a@example.com");
    expect(getAccessToken()).toBe("access-1");
  });

  it("복구에 실패하면 로그아웃 상태가 된다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "AUTH_FAILED", message: "x" }, 401));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(getAccessToken()).toBeNull();
  });

  it("구글 ID 토큰으로 로그인하면 토큰 없이(auth:false) 서버에 보내고 상태를 바꾼다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "AUTH_FAILED", message: "x" }, 401)); // 시작 복구 실패
    fetchMock.mockResolvedValueOnce(json(AUTH)); // 로그인
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/v1/auth/google");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ idToken: "google-id-token" });
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(getAccessToken()).toBe("access-1");
  });

  it("로그아웃하면 서버 호출이 실패해도 토큰과 사용자 상태를 지운다", async () => {
    fetchMock.mockResolvedValueOnce(json(AUTH)); // 시작 복구
    fetchMock.mockRejectedValueOnce(new TypeError("network")); // 로그아웃 호출 실패
    render(<AuthProvider><AuthControls /></AuthProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "로그인" })).toBeInTheDocument());
    expect(getAccessToken()).toBeNull();
  });

  it("로그아웃하면 구글 자동 로그인 선택도 끈다 (공용 PC에서 이전 계정으로 바로 로그인되지 않게)", async () => {
    disableAutoSelect.mockClear();
    fetchMock.mockResolvedValueOnce(json(AUTH)); // 시작 복구
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })); // 로그아웃 호출
    render(<AuthProvider><AuthControls /></AuthProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(disableAutoSelect).toHaveBeenCalledTimes(1));
  });

  it("구글 스크립트를 못 불러와도 로그아웃은 정상 완료된다", async () => {
    vi.mocked(loadGoogleIdentity).mockRejectedValueOnce(new Error("offline"));
    fetchMock.mockResolvedValueOnce(json(AUTH)); // 시작 복구
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<AuthProvider><AuthControls /></AuthProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "로그인" })).toBeInTheDocument());
  });

  it("재발급까지 실패해 로그인이 풀리면 화면도 로그아웃 상태가 된다", async () => {
    fetchMock.mockResolvedValueOnce(json(AUTH)); // 시작 복구
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    fetchMock.mockResolvedValueOnce(json({ code: "AUTH_FAILED", message: "x" }, 401)); // 일반 API 401
    fetchMock.mockResolvedValueOnce(json({ code: "AUTH_FAILED", message: "x" }, 401)); // 재발급도 실패
    await expect(apiFetch("/records")).rejects.toMatchObject({ status: 401 });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("user")).toHaveTextContent("-");
    expect(getAccessToken()).toBeNull();
  });

  it("로그인 전 복구 중에는 헤더에 로그인/로그아웃 버튼을 보여 주지 않는다", () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // 끝나지 않는 요청
    render(<AuthProvider><AuthControls /></AuthProvider>);
    expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
    expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
  });
});
