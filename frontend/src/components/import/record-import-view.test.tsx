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
    expect(screen.getByText(/토큰은 필요 없습니다/)).toBeInTheDocument();
  });

  it("일반 사용자에게는 준비 중 안내만 보인다", async () => {
    fetchMock.mockImplementation((input) => Promise.resolve(String(input).endsWith("/auth/refresh") ? login("USER") : json({})));
    renderIt();
    expect(await screen.findByText("이 기능은 아직 준비 중입니다.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/record-imports/"))).toBe(false);
  });
});
