import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { RecordImportGate } from "@/components/import/RecordImportView";
import { ToastProvider } from "@/components/Toast";
import { clearAccessToken } from "@/lib/auth-token";
import type { ReadPlay } from "@/lib/import-bookmarklet";
import { addPlays, clearHandoff, getHandoff, resetHandoffCache } from "@/lib/import-handoff";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/import" }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function login(role: "USER" | "ROOT") {
  return json({ accessToken: "t", tokenType: "Bearer", expiresIn: 900, user: { id: 1, email: "a@example.com", nickname: null, role, createdAt: "2026-10-01T00:00:00Z" } });
}
function play(title: string, rate: number, extra: Partial<ReadPlay> = {}): ReadPlay {
  return { playedAtMs: 1791796344469 + title.charCodeAt(0), gameType: "gf", title, difficultyClass: "gf_mst", rate, ok: 0, miss: 2, translated: false, options: [], ...extra };
}

const PREVIEW = {
  saved: 2,
  skipped: 2,
  skippedByReason: { LOWER_THAN_BEST: 1, SONG_NOT_FOUND: 1 },
  excludedSongs: ["C"],
  results: [
    { index: 0, title: "A", saved: true, reason: null, previousBestRate: 91.2 },
    { index: 1, title: "B", saved: true, reason: null, previousBestRate: null },
    { index: 2, title: "D", saved: false, reason: "LOWER_THAN_BEST", previousBestRate: 94 },
    { index: 3, title: "C", saved: false, reason: "SONG_NOT_FOUND", previousBestRate: null },
  ],
};

describe("최근 플레이 가져오기 화면", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let skillCalls = 0;
  let commitBody: { plays: { title: string }[] } | null = null;

  beforeEach(() => {
    clearAccessToken();
    window.localStorage.clear();
    resetHandoffCache();
    clearHandoff();
    skillCalls = 0;
    commitBody = null;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(login("ROOT"));
      if (url.endsWith("/record-imports/preview")) return Promise.resolve(json(PREVIEW));
      if (url.endsWith("/record-imports/commit")) {
        commitBody = JSON.parse(String(init?.body));
        return Promise.resolve(json({ ...PREVIEW, skipped: 0, skippedByReason: {}, excludedSongs: [], results: [] }));
      }
      if (url.endsWith("/skills/me")) {
        skillCalls += 1;
        return Promise.resolve(json({ totalScore: skillCalls === 1 ? 10638.13 : 10650.53, single: [], other: [] }));
      }
      return Promise.resolve(json({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    addPlays([play("A", 9650), play("B", 8810), play("D", 9030), play("C", 8500)], 0);
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

  it("미리보기에서 저장 예정·건너뜀·제외를 나눠 보여 준다", async () => {
    renderIt();
    expect(await screen.findByText("✓ 저장 예정 2")).toBeInTheDocument();
    expect(screen.getByText("건너뜀 1")).toBeInTheDocument();
    expect(screen.getByText("제외 1")).toBeInTheDocument();
    expect(screen.getByText("새 기록 · 91.20 → 96.50")).toBeInTheDocument();
    expect(screen.getByText("첫 기록")).toBeInTheDocument();
    expect(screen.getByText("건너뜀 · 기존 기록(94.00)보다 낮음")).toBeInTheDocument();
    expect(screen.getByText("제외 · 곡 목록에 없음")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "곡 추가 건의하기" })).toHaveAttribute("href", "/suggestions?category=SONG_REQUEST&title=C");
    // 저장 안 하는 줄은 체크할 수 없다
    expect(screen.getByRole("checkbox", { name: "D 저장 안 함" })).toBeDisabled();
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/record-imports/commit"))).toBe(false);
  });

  it("지원하지 않는 난이도는 공식 난이도 클래스를 함께 보여 준다", async () => {
    clearHandoff();
    addPlays([play("E", 9000, { difficultyClass: "dm_ext" })], 0);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(login("USER"));
      if (url.endsWith("/record-imports/preview"))
        return Promise.resolve(
          json({ saved: 0, skipped: 1, skippedByReason: { UNKNOWN_DIFFICULTY: 1 }, excludedSongs: [], results: [{ index: 0, title: "E", saved: false, reason: "UNKNOWN_DIFFICULTY", previousBestRate: null }] }),
        );
      return Promise.resolve(json({}));
    });
    renderIt();
    expect(await screen.findByText("건너뜀 · 지원하지 않는 난이도 (dm_ext)")).toBeInTheDocument();
  });

  it("체크를 풀면 그 곡은 저장하지 않고, 고른 곡만 보낸 뒤 레이팅 변화를 보여 준다", async () => {
    renderIt();
    fireEvent.click(await screen.findByRole("checkbox", { name: "B 저장" }));
    expect(screen.getByRole("button", { name: "1곡 저장" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "1곡 저장" }));
    expect(await screen.findByText(/곡을 저장했습니다/)).toBeInTheDocument();
    expect(commitBody?.plays.map((p) => p.title)).toEqual(["A"]);
    expect(screen.getByText("레이팅 +12.40 (10638.13 → 10650.53)")).toBeInTheDocument();
    expect(screen.getByText("1/4쪽을 가져왔습니다.", { exact: false })).toBeInTheDocument();
    expect(getHandoff().pending).toHaveLength(0);
    expect(screen.getByRole("link", { name: "내 레이팅 보기" })).toHaveAttribute("href", "/me?tab=rating");
  });

  it("취소하면 받은 플레이를 비운다", async () => {
    renderIt();
    fireEvent.click(await screen.findByRole("button", { name: "취소" }));
    await waitFor(() => expect(getHandoff().pending).toHaveLength(0));
    expect(screen.getByText(/받은 플레이가 없습니다/)).toBeInTheDocument();
  });

  it("받은 플레이가 없으면 북마크 만들기 안내만 보인다(토큰은 필요 없음)", async () => {
    clearHandoff();
    renderIt();
    expect(await screen.findByText(/받은 플레이가 없습니다/)).toBeInTheDocument();
    expect(screen.getByText("SRP 가져오기")).toBeInTheDocument();
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
    expect(await screen.findByText(/받은 플레이가 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("이 기능은 아직 준비 중입니다.")).toBeNull();
  });
});
