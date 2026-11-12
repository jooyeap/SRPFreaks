import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/NotificationBell";
import { resetHistoryLayersForTest } from "@/lib/history-layers";
import type { NotificationResponse } from "@/lib/api-types";

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
const base: NotificationResponse = {
  id: 1, actorUserId: 7, actorNickname: "Rumi", songId: 3, songDifficultyId: 5, title: "MEGALOVANIA", part: "BASS",
  difficulty: "MASTER", level: 8.65, actorRate: 96.4, myRate: 96.1, bundled: false, songCount: 1,
  visibleAt: new Date().toISOString(), read: false,
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
        content: [base, { ...base, id: 2, actorUserId: 8, actorNickname: "ASTRA", bundled: true, songCount: 3, title: "KAISER PHOENIX", read: true }],
        page: 0, size: 20, totalElements: 2, totalPages: 1,
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
    const mk = (id: number, extra: Partial<NotificationResponse> = {}): NotificationResponse => ({
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
