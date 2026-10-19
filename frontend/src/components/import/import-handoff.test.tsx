import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { ImportHandoff } from "@/components/import/ImportHandoff";
import { clearAccessToken } from "@/lib/auth-token";
import { addPlays, clearHandoff, resetHandoffCache } from "@/lib/import-handoff";
import type { ReadPlay } from "@/lib/import-bookmarklet";

const push = vi.fn();
let pathname = "/";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push, back: vi.fn() }), usePathname: () => pathname }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function login(role: "USER" | "ROOT") {
  return json({ accessToken: "t", tokenType: "Bearer", expiresIn: 900, user: { id: 1, email: "a@example.com", nickname: null, role, createdAt: "2026-10-01T00:00:00Z" } });
}
const play: ReadPlay = { playedAtMs: 1791796344469, gameType: "gf", title: "A", difficultyClass: "gf_mst", rate: 9650, ok: 0, miss: 1, translated: false, options: [] };

describe("받은 플레이 이어서 처리 모달", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    window.localStorage.clear();
    resetHandoffCache();
    clearHandoff();
    window.history.replaceState(null, "", "/");
    pathname = "/";
    push.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderIt = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <ImportHandoff />
        </AuthProvider>
      </QueryClientProvider>,
    );

  it("받은 플레이가 없으면 모달이 없다", async () => {
    fetchMock.mockResolvedValue(login("ROOT"));
    renderIt();
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("주소 조각으로 플레이가 오면 모달이 뜨고, 이어서 처리를 누르면 /import로 간다", async () => {
    fetchMock.mockResolvedValue(login("ROOT"));
    window.history.replaceState(null, "", `/${`#srp=${encodeURIComponent(JSON.stringify({ plays: [play], unreadable: 0 }))}`}`);
    renderIt();
    expect(await screen.findByText("공식 페이지에서 받은 플레이가 있습니다")).toBeInTheDocument();
    expect(screen.getByText(/1곡을 받았습니다/)).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    fireEvent.click(await screen.findByRole("button", { name: "이어서 처리" }));
    expect(push).toHaveBeenCalledWith("/import");
    expect(screen.queryByText("공식 페이지에서 받은 플레이가 있습니다")).toBeNull();
  });

  it("나중에를 누르면 닫히고, 같은 탭으로 다음 쪽이 오면(hashchange) 다시 뜬다", async () => {
    fetchMock.mockResolvedValue(login("ROOT"));
    addPlays([play], 0);
    renderIt();
    fireEvent.click(await screen.findByRole("button", { name: "나중에" }));
    expect(screen.queryByText("공식 페이지에서 받은 플레이가 있습니다")).toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
      window.history.replaceState(null, "", `/#srp=${encodeURIComponent(JSON.stringify({ plays: [{ ...play, title: "B" }], unreadable: 0 }))}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(await screen.findByText(/2곡을 받았습니다/)).toBeInTheDocument();
  });

  it("/import 화면에서는 모달을 띄우지 않는다", async () => {
    fetchMock.mockResolvedValue(login("ROOT"));
    pathname = "/import";
    addPlays([play], 0);
    renderIt();
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("준비 중인 일반 사용자에게는 모달을 보이지 않는다", async () => {
    fetchMock.mockResolvedValue(login("USER"));
    addPlays([play], 0);
    renderIt();
    await act(async () => {});
    expect(screen.queryByText("공식 페이지에서 받은 플레이가 있습니다")).toBeNull();
  });

  it("로그아웃 상태면 로그인으로 안내한다", async () => {
    fetchMock.mockResolvedValue(json({ code: "UNAUTHORIZED", message: "x" }, 401));
    addPlays([play], 0);
    renderIt();
    expect(await screen.findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });
});
