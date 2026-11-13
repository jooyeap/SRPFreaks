import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/NotificationBell";
import { resetHistoryLayersForTest } from "@/lib/history-layers";
import type { NotificationResponse, RivalNotificationResponse, TierNotificationResponse } from "@/lib/api-types";

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
          { ...base, id: 2, actorUserId: 8, actorNickname: "ASTRA", bundled: true, songCount: 3, title: "KAISER PHOENIX", read: true },
          { ...tier, id: 2, title: "Bundle Song", bundled: true, songCount: 6, read: true },
          { ...tier, id: 3, title: "Undecided Song", beforeTier: null, beforeScore: null, scoreDiff: null, read: true },
        ],
        page: 0, size: 20, totalElements: 5, totalPages: 1,
      });
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetHistoryLayersForTest();
  });

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

    // 창이 쌓은 history 칸을 걷어낸 뒤에 이동하므로 한 틱 뒤에 불린다(lib/history-layers.ts)
    await waitFor(() => expect(push).toHaveBeenCalledWith("/players/7/compare?view=charts"));
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

    // 창이 쌓은 history 칸을 걷어낸 뒤에 이동하므로 한 틱 뒤에 불린다(lib/history-layers.ts)
    await waitFor(() => expect(push).toHaveBeenCalledWith("/songs/9"));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/notifications/tier/1/read"))).toBe(true),
    );

    fireEvent.click(await screen.findByRole("button", { name: "알림 12개" }));
    fireEvent.click(await screen.findByRole("button", { name: /Bundle Song/ }));
    await waitFor(() => expect(push).toHaveBeenLastCalledWith("/notices#tier-changes"));
  });

  it("긴 알림 문장은 줄바꿈으로 모두 보이고 가로 스크롤이 생기지 않는다", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/unread-count")) return json({ count: 1 });
      return json({
        content: [{ ...base, actorNickname: "A".repeat(60), title: "VERY-LONG-TITLE-".repeat(8) }],
        page: 0, size: 20, totalElements: 1, totalPages: 1,
      });
    });
    renderWith(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "알림 1개" }));
    const dialog = await screen.findByRole("dialog", { name: "알림" });
    const list = dialog.querySelector("ul");
    // 가로로 스크롤되는 클래스가 없고 가로 넘침은 숨긴다
    expect(list?.className).not.toMatch(/overflow-x-(auto|scroll)/);
    expect(list?.className).toContain("overflow-x-hidden");
    // 창은 헤더 안에 있어 헤더의 nowrap을 물려받으므로 창에서 풀어 준다(2026-11-12: 문장이 한 줄로 잘리고 가로 스크롤이 생겼다)
    expect(dialog).toHaveClass("whitespace-normal");
    // 글자가 한 줄로 잘리는 클래스(truncate, nowrap)가 없고, 붙은 긴 글자도 어디서든 줄바꿈된다
    const text = (await screen.findByText(/VERY-LONG-TITLE-/)).closest("span.block");
    expect(text?.parentElement?.className).toContain("[overflow-wrap:anywhere]");
    expect(dialog.innerHTML).not.toMatch(/truncate|whitespace-nowrap|text-ellipsis/);
  });

  it("뒤로 가기를 누르면 알림 창만 닫히고 주소는 그대로다", async () => {
    window.history.replaceState(null, "", "/start");
    renderWith(<NotificationBell />);
    const before = window.history.length;
    fireEvent.click(await screen.findByRole("button", { name: "알림 12개" }));
    await screen.findByRole("dialog", { name: "알림" });
    expect(window.history.length).toBe(before + 1);

    window.history.back();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "알림" })).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/start");
  });
  describe("같은 사람의 연속된 알림 묶음", () => {
    const mk = (id: number, extra: Partial<RivalNotificationResponse> = {}): RivalNotificationResponse => ({
      ...base, id, title: `SONG-${id}`, ...extra,
    });
    function listOf(content: NotificationResponse[]) {
      fetchMock.mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("/unread-count")) return json({ count: content.filter((c) => !c.read).length });
        if (url.includes("/notifications/")) return new Response(null, { status: 204 });
        return json({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });
      });
    }
    async function openPanel(name = "알림 1개") {
      renderWith(<NotificationBell />);
      fireEvent.click(await screen.findByRole("button", { name }));
      return screen.findByRole("dialog", { name: "알림" });
    }

    it("안 읽은 줄이 있는 묶음은 펼쳐서 시작하고 처음 3줄만 보이며, 나머지는 `N곡 더 보기`로 펼친다", async () => {
      listOf([5, 4, 3, 2, 1].map((id) => mk(id)));
      const dialog = await openPanel("알림 5개");
      const head = await screen.findByRole("button", { name: /Rumi님 · 5곡/ });
      expect(head).toHaveAttribute("aria-expanded", "true");
      expect(dialog).toHaveTextContent("새 알림 5");
      expect(dialog).toHaveTextContent("SONG-5");
      expect(dialog).toHaveTextContent("SONG-3");
      expect(dialog).not.toHaveTextContent("SONG-2");
      fireEvent.click(screen.getByRole("button", { name: "2곡 더 보기" }));
      expect(dialog).toHaveTextContent("SONG-2");
      expect(dialog).toHaveTextContent("SONG-1");
      expect(screen.queryByRole("button", { name: /곡 더 보기/ })).not.toBeInTheDocument();
    });

    it("3줄 이하면 `더 보기` 버튼이 없다", async () => {
      listOf([3, 2, 1].map((id) => mk(id)));
      await openPanel("알림 3개");
      await screen.findByRole("button", { name: /Rumi님 · 3곡/ });
      expect(screen.queryByRole("button", { name: /곡 더 보기/ })).not.toBeInTheDocument();
    });

    it("모두 읽은 묶음은 접어서 시작하고, 머리 줄을 누르면 펼친다", async () => {
      listOf([3, 2, 1].map((id) => mk(id, { read: true })));
      const dialog = await openPanel("알림");
      const head = await screen.findByRole("button", { name: /Rumi님 · 3곡/ });
      expect(head).toHaveAttribute("aria-expanded", "false");
      expect(dialog).not.toHaveTextContent("SONG-3");
      expect(dialog).not.toHaveTextContent("새 알림");
      fireEvent.click(head);
      expect(head).toHaveAttribute("aria-expanded", "true");
      expect(dialog).toHaveTextContent("SONG-3");
      fireEvent.click(head);
      expect(head).toHaveAttribute("aria-expanded", "false");
    });

    it("서버가 묶은 줄은 songCount곡으로 세고, 사이에 다른 사람이 끼면 따로 묶는다", async () => {
      listOf([
        mk(4, { bundled: true, songCount: 4, read: true }),
        mk(3, { read: true }),
        mk(2, { actorUserId: 9, actorNickname: "Mira", read: true }),
        mk(1, { read: true }),
      ]);
      await openPanel("알림");
      expect(await screen.findByRole("button", { name: /Rumi님 · 5곡/ })).toBeInTheDocument();
      // 한 줄짜리 묶음(Mira, 뒤쪽 Rumi)은 묶지 않고 예전 모양 그대로 보인다
      expect(screen.getByRole("button", { name: /Mira님이 SONG-2/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Rumi님이 SONG-1/ })).toBeInTheDocument();
    });

    it("서열표 알림은 묶지 않고, 같은 사람의 라이벌 알림 사이에 끼면 연달아가 끊겨 따로 묶는다", async () => {
      listOf([
        mk(5, { read: true }),
        mk(4, { read: true }),
        { ...tier, id: 1, title: "TIER-SONG", read: true },
        mk(3, { read: true }),
        mk(2, { read: true }),
        { ...tier, id: 2, title: "TIER-SONG-2", read: true },
      ]);
      const dialog = await openPanel("알림");
      // 서열표 앞쪽 라이벌 2줄, 뒤쪽 라이벌 2줄이 각각 묶인다(같은 사람이어도 서열표 알림이 사이에 있으면 합치지 않는다)
      expect(await screen.findAllByRole("button", { name: /Rumi님 · 2곡/ })).toHaveLength(2);
      // 서열표 알림은 머리 줄 없이 한 줄씩 칩(서열표)과 함께 보이고, 상대 닉네임 없이도 깨지지 않는다
      const tierRows = screen.getAllByRole("button", { name: /TIER-SONG/ });
      expect(tierRows).toHaveLength(2);
      for (const row of tierRows) expect(row).toHaveTextContent("서열표");
      expect(dialog).not.toHaveTextContent("알 수 없음");
    });

    it("묶음 안의 줄을 누르면 기존과 똑같이 읽음 처리하고 그 사람과의 곡별 승패로 간다", async () => {
      listOf([3, 2, 1].map((id) => mk(id)));
      await openPanel("알림 3개");
      fireEvent.click(await screen.findByRole("button", { name: /SONG-2/ }));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/players/7/compare?view=charts"));
      await waitFor(() =>
        expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/notifications/2/read"))).toBe(true),
      );
      // 묶기는 화면에서만 한다: 읽음 API는 줄 하나에 한 번만 불린다
      const reads = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/read"));
      expect(reads).toHaveLength(1);
    });

    it("머리 줄을 눌러도 읽음 처리나 이동은 일어나지 않는다", async () => {
      listOf([3, 2, 1].map((id) => mk(id, { read: true })));
      await openPanel("알림");
      fireEvent.click(await screen.findByRole("button", { name: /Rumi님 · 3곡/ }));
      expect(push).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/read"))).toBe(false);
    });
  });
});
