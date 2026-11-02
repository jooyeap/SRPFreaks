import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/NotificationBell";
import type { RivalNotificationResponse, TierNotificationResponse } from "@/lib/api-types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
let authed = true;
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => (authed ? { status: "authenticated", user: { id: 1 } } : { status: "anonymous", user: null }),
}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function renderWith(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const base: RivalNotificationResponse = {
  kind: "RIVAL", id: 1, actorUserId: 7, actorNickname: "Rumi", songId: 3, songDifficultyId: 5, title: "MEGALOVANIA", part: "BASS",
  difficulty: "MASTER", level: 8.65, actorRate: 96.4, myRate: 96.1, bundled: false, songCount: 1,
  visibleAt: new Date().toISOString(), read: false,
};
const tier: TierNotificationResponse = {
  kind: "TIER", id: 1, songId: 9, songDifficultyId: 11, title: "Cosmic Cat", part: "GUITAR", difficulty: "EXTREME", level: 8.2,
  myRate: 90, beforeTier: 6.5, afterTier: 7.0, beforeScore: 322.67, afterScore: 362.67, scoreDiff: 40, bundled: false,
  songCount: 1, visibleAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), read: false,
};
const fetchMock = vi.fn<typeof fetch>();

describe("NotificationBell", () => {
  beforeEach(() => {
    authed = true;
    push.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/unread-count")) return json({ count: 12 });
      if (url.includes("/notifications/")) return new Response(null, { status: 204 });
      return json({
        content: [
          base,
          tier,
          { ...base, id: 2, actorNickname: "ASTRA", bundled: true, songCount: 3, title: "KAISER PHOENIX", read: true },
          { ...tier, id: 2, title: "Bundle Song", bundled: true, songCount: 6, read: true },
          { ...tier, id: 3, title: "Undecided Song", beforeTier: null, beforeScore: null, scoreDiff: null, read: true },
        ],
        page: 0, size: 20, totalElements: 5, totalPages: 1,
      });
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("로그인하지 않았으면 그리지 않는다", () => {
    authed = false;
    const { container } = renderWith(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
  });

  it("안 읽은 개수를 배지로(9 넘으면 9+) 보이고, 열면 따로·묶음 알림 문구를 보인다", async () => {
    renderWith(<NotificationBell />);
    const bell = await screen.findByRole("button", { name: "알림 12개" });
    expect(bell).toHaveTextContent("9+");

    fireEvent.click(bell);
    const dialog = await screen.findByRole("dialog", { name: "알림" });
    expect(await screen.findByText(/MEGALOVANIA/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Rumi님이 MEGALOVANIA (Bass MAS) 곡을 역전했습니다.");
    expect(dialog).toHaveTextContent("Rumi 96.40 · 내 기록 96.10");
    expect(dialog).toHaveTextContent("ASTRA님이 3곡을 역전했습니다.");
    expect(dialog).toHaveTextContent("KAISER PHOENIX 외 2곡");
    expect(dialog).toHaveTextContent("새 알림");
    expect(dialog).toHaveTextContent("알림은 30일 동안 보관됩니다.");
  });

  it("알림을 누르면 읽음 처리하고 그 사람과의 곡별 승패로 간다", async () => {
    renderWith(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "알림 12개" }));
    fireEvent.click(await screen.findByRole("button", { name: /MEGALOVANIA/ }));

    expect(push).toHaveBeenCalledWith("/players/7/compare?view=charts");
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/notifications/1/read"))).toBe(true),
    );
  });

  it("서열표 변경 알림은 칩·바뀐 값·내 점수 전후(차이)를 보이고, 미정·묶음도 글자로 보인다", async () => {
    renderWith(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "알림 12개" }));
    const dialog = await screen.findByRole("dialog", { name: "알림" });
    const tierRow = await screen.findByRole("button", { name: /Cosmic Cat/ });

    expect(tierRow).toHaveTextContent("서열표");
    expect(tierRow).toHaveTextContent("Cosmic Cat (Guitar EXT) 기준 난이도 6.5 → 7.0");
    expect(tierRow).toHaveTextContent("내 점수 322.67 → 362.67 (+40.00)");
    expect(dialog).toHaveTextContent("라이벌");
    expect(dialog).toHaveTextContent("6채보의 기준 난이도가 바뀌었습니다.");
    expect(dialog).toHaveTextContent("Bundle Song 외 5채보");
    expect(dialog).toHaveTextContent("Undecided Song (Guitar EXT) 기준 난이도 미정 → 7.0");
    expect(dialog).toHaveTextContent("내 점수 미정 → 362.67");
  });

  it("서열표 알림을 누르면 서열표용 경로로 읽음 처리하고 곡 상세로, 묶음은 서열표 변경 탭으로 간다", async () => {
    renderWith(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "알림 12개" }));
    fireEvent.click(await screen.findByRole("button", { name: /Cosmic Cat/ }));

    expect(push).toHaveBeenCalledWith("/songs/9");
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/notifications/tier/1/read"))).toBe(true),
    );

    fireEvent.click(await screen.findByRole("button", { name: "알림 12개" }));
    fireEvent.click(await screen.findByRole("button", { name: /Bundle Song/ }));
    expect(push).toHaveBeenLastCalledWith("/notices#tier-changes");
  });
});
