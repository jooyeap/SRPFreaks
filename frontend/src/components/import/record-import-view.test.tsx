import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { RecordImportGate } from "@/components/import/RecordImportView";
import { ToastProvider } from "@/components/Toast";
import { clearAccessToken } from "@/lib/auth-token";
import { clearHandoff, resetHandoffCache } from "@/lib/import-handoff";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/import" }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function login(role: "USER" | "ROOT") {
  return json({ accessToken: "t", tokenType: "Bearer", expiresIn: 900, user: { id: 1, email: "a@example.com", nickname: null, role, createdAt: "2026-10-01T00:00:00Z" } });
}

describe("최근 플레이 가져오기 안내 화면", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    clearAccessToken();
    window.localStorage.clear();
    resetHandoffCache();
    clearHandoff();
    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => Promise.resolve(String(input).endsWith("/auth/refresh") ? login("ROOT") : json({})));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderIt = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <ToastProvider>
            <RecordImportGate />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );

  it("로그인하지 않았으면 로그인 안내를 보여 주고, 빈 공간이 한쪽으로 몰리지 않게 세로 가운데에 놓는다", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json({ code: "AUTH_FAILED", message: "x" }, 401)); // 시작 복구 실패(로그인 안 된 상태)
    renderIt();
    const login = await screen.findByRole("link", { name: "로그인" });
    expect(login).toHaveAttribute("href", "/login");
    // 푸터는 맨 아래에 붙어 있어서, 짧은 안내 화면의 내용을 가운데에 두어야 로그인 버튼 아래만 비어 보이지 않는다
    const section = login.closest("section");
    expect(section).toHaveClass("justify-center");
    expect(section?.className).toContain("min-h-[40svh]");
  });

  it("북마크 만들기 안내가 보인다(토큰은 필요 없음)", async () => {
    clearHandoff();
    renderIt();
    expect(await screen.findByText("SRP 가져오기")).toBeInTheDocument();
    expect(screen.getByText(/토큰이나 계정 정보는 필요 없습니다/)).toBeInTheDocument();
    expect(screen.getByText(/다른 페이지에서는 동작하지 않고 안내만 뜹니다/)).toBeInTheDocument();
  });

  it("주소창 실행용 스크립트는 맨 앞 j를 뺀 avascript:...로 복사한다(브라우저가 붙여넣은 javascript: 접두사를 지우기 때문)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    clearHandoff();
    renderIt();
    fireEvent.click(await screen.findByRole("tab", { name: "모바일" }));
    fireEvent.click(await screen.findByRole("button", { name: "실행용 스크립트 복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = String(writeText.mock.calls[0][0]);
    expect(copied.startsWith("avascript:")).toBe(true);
    expect(`j${copied}`.startsWith("javascript:")).toBe(true);
    const body = decodeURIComponent(copied.slice("avascript:".length));
    expect(body).toContain("srpfreaks-import");
    expect(body).not.toContain("srpi_");
    expect(screen.getByText(/맨 앞 j만 직접 입력합니다/)).toBeInTheDocument();
  });

  it("PC 탭: 끌어다 놓기 그림과 북마크 바 스크린샷, 공식 사이트 경로, 저장 기준, 실행 오류 안내를 보여 준다", async () => {
    clearHandoff();
    renderIt();
    expect(await screen.findByRole("tab", { name: "PC", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /끌어서 놓는 방법/ })).toHaveAttribute("src", "/import-guide/bookmark-drag-howto.svg");
    expect(screen.getByRole("img", { name: /북마크 바에 SRP 가져오기/ })).toHaveAttribute("src", "/import-guide/bookmark-drag.png");
    expect(screen.getByText("상단 플레이 데이터")).toBeInTheDocument();
    expect(screen.getByText("좌측 슬라이드바 플레이 이력")).toBeInTheDocument();
    expect(screen.getByText("어떤 기록이 저장되나요?")).toBeInTheDocument();
    expect(screen.getByText(/필요시 건의하기로 이어집니다/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "실행 오류" })).toBeInTheDocument();
    expect(screen.getByText("번역을 켜 둔 상태예요")).toBeInTheDocument();
    // PC 탭에는 주소창용 안내가 없다
    expect(screen.queryByRole("button", { name: "실행용 스크립트 복사" })).toBeNull();
  });

  it("모바일 탭: 주소창 스크린샷과 j 입력 안내를 보여 주고 PC 전용 그림은 숨긴다", async () => {
    clearHandoff();
    renderIt();
    fireEvent.click(await screen.findByRole("tab", { name: "모바일" }));
    expect(screen.getByRole("img", { name: /주소창에 j를 입력/ })).toHaveAttribute("src", "/import-guide/address-bar.png");
    expect(screen.queryByRole("img", { name: /끌어서 놓는 방법/ })).toBeNull();
    expect(screen.getByText(/맨 앞 j만 직접 입력합니다/)).toBeInTheDocument();
  });

  it("일반 사용자도 가져오기 화면을 쓸 수 있고 준비 중 안내는 보이지 않는다", async () => {
    clearHandoff();
    fetchMock.mockImplementation((input) => Promise.resolve(String(input).endsWith("/auth/refresh") ? login("USER") : json({})));
    renderIt();
    expect(await screen.findByText("SRP 가져오기")).toBeInTheDocument();
    expect(screen.queryByText("이 기능은 아직 준비 중입니다.")).toBeNull();
  });
});
