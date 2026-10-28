import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { ImportHandoff } from "@/components/import/ImportHandoff";
import { clearAccessToken } from "@/lib/auth-token";
import type { ReadPlay } from "@/lib/import-bookmarklet";
import { addPlays, clearHandoff, getHandoff, resetHandoffCache } from "@/lib/import-handoff";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/me" }));

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

describe("가져오기 처리 모달(미리보기·저장·결과)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let skillCalls = 0;
  let commitBody: { plays: { title: string }[] } | null = null;
  let snapshotStatus: { available: boolean; reason: string | null; replacesToday: boolean } = { available: false, reason: "NO_CHANGE", replacesToday: false };
  let snapshotPosts = 0;

  beforeEach(() => {
    clearAccessToken();
    window.localStorage.clear();
    resetHandoffCache();
    clearHandoff();
    skillCalls = 0;
    commitBody = null;
    snapshotStatus = { available: false, reason: "NO_CHANGE", replacesToday: true };
    snapshotPosts = 0;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(login("ROOT"));
      if (url.endsWith("/record-imports/preview")) return Promise.resolve(json(PREVIEW));
      if (url.endsWith("/record-imports/commit")) {
        commitBody = JSON.parse(String(init?.body));
        return Promise.resolve(json({ ...PREVIEW, skipped: 0, skippedByReason: {}, excludedSongs: [], results: [] }));
      }
      if (url.endsWith("/skills/me/snapshots/status")) return Promise.resolve(json(snapshotStatus));
      if (url.endsWith("/skills/me/snapshots") && init?.method === "POST") {
        snapshotPosts += 1;
        snapshotStatus = { available: false, reason: "NO_CHANGE", replacesToday: true };
        return Promise.resolve(json({ id: 1, date: "2026-10-27", totalScore: 10650.53, singleScore: 1, otherScore: 1, change: 12.4 }));
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
          <ImportHandoff />
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
    expect(screen.getByRole("link", { name: "곡 추가 건의하기" })).toHaveAttribute("href", "/suggestions?category=SONG_REQUEST&title=C&part=GUITAR&difficulty=MASTER");
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
    // 저장이 끝나 받은 플레이가 비어도 모달은 결과 화면으로 남아 있다
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(getHandoff().pending).toHaveLength(0);
    expect(screen.getByRole("link", { name: "내 레이팅 보기" })).toHaveAttribute("href", "/me?tab=rating");
  });

  async function saveOne() {
    renderIt();
    fireEvent.click(await screen.findByRole("checkbox", { name: "B 저장" }));
    fireEvent.click(screen.getByRole("button", { name: "1곡 저장" }));
    await screen.findByText(/곡을 저장했습니다/);
  }

  it("저장이 끝나고 기록할 수 있으면 `지금 레이팅 기록하기`를 보여 주고, 누르면 한 번만 기록한다", async () => {
    snapshotStatus = { available: true, reason: null, replacesToday: false };
    await saveOne();
    fireEvent.click(await screen.findByRole("button", { name: "지금 레이팅 기록하기" }));
    await waitFor(() => expect(snapshotPosts).toBe(1));
    // 기록하고 나면 오늘은 더 할 수 없으니 버튼이 사라진다
    await waitFor(() => expect(screen.queryByRole("button", { name: "지금 레이팅 기록하기" })).toBeNull());
  });

  it("오늘 이미 기록했으면 `오늘 기록 갱신`으로 보이고 누르면 오늘 기록을 덮어쓴다", async () => {
    snapshotStatus = { available: true, reason: null, replacesToday: true };
    await saveOne();
    fireEvent.click(await screen.findByRole("button", { name: "오늘 기록 갱신" }));
    await waitFor(() => expect(snapshotPosts).toBe(1));
  });

  it("점수가 같아 기록할 수 없으면 버튼을 보이지 않는다", async () => {
    snapshotStatus = { available: false, reason: "NO_CHANGE", replacesToday: false };
    await saveOne();
    expect(screen.queryByRole("button", { name: "지금 레이팅 기록하기" })).toBeNull();
    expect(snapshotPosts).toBe(0);
  });

  it("저장한 곡이 없으면(전부 건너뜀) 기록 버튼을 보이지 않는다", async () => {
    snapshotStatus = { available: true, reason: null, replacesToday: false };
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(login("ROOT"));
      if (url.endsWith("/record-imports/preview")) return Promise.resolve(json(PREVIEW));
      if (url.endsWith("/record-imports/commit")) return Promise.resolve(json({ ...PREVIEW, saved: 0, results: [] }));
      if (url.endsWith("/skills/me/snapshots/status")) return Promise.resolve(json(snapshotStatus));
      if (url.endsWith("/skills/me")) return Promise.resolve(json({ totalScore: 10638.13, single: [], other: [] }));
      void init;
      return Promise.resolve(json({}));
    });
    renderIt();
    fireEvent.click(await screen.findByRole("button", { name: "2곡 저장" }));
    expect(await screen.findByText("저장된 기록이 없습니다")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "지금 레이팅 기록하기" })).toBeNull();
  });

  it("취소하면 받은 플레이를 비운다", async () => {
    renderIt();
    fireEvent.click(await screen.findByRole("button", { name: "취소" }));
    await waitFor(() => expect(getHandoff().pending).toHaveLength(0));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("저장 전에 창을 닫아도 받은 플레이는 남아 있고, 다음에 화면을 열면 모달이 다시 뜬다", async () => {
    const first = renderIt();
    expect(await screen.findByText("✓ 저장 예정 2")).toBeInTheDocument();
    first.unmount();
    expect(getHandoff().pending).toHaveLength(4);
    renderIt();
    expect(await screen.findByText("✓ 저장 예정 2")).toBeInTheDocument();
  });
});
