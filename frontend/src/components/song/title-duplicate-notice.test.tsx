import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitleDuplicateNotice } from "@/components/song/TitleDuplicateNotice";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("TitleDuplicateNotice (곡명 중복 실시간 확인)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderNotice(title: string, excludeSongId?: number) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = (value: string) => (
      <QueryClientProvider client={client}>
        <TitleDuplicateNotice title={value} excludeSongId={excludeSongId} />
      </QueryClientProvider>
    );
    const view = render(ui(title));
    return { ...view, setTitle: (value: string) => view.rerender(ui(value)) };
  }

  it("같은 이름의 곡이 있으면 경고와 그 곡으로 가는 링크를 보여 준다", async () => {
    fetchMock.mockResolvedValue(json({ duplicate: true, songId: 5, title: "童話回廊" }));
    renderNotice("童話回廊");

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("⚠ 같은 이름의 곡이 이미 있습니다.");
    expect(screen.getByRole("link", { name: "童話回廊" })).toHaveAttribute("href", "/songs/5?from=songs");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/songs/title-check?title=%E7%AB%A5%E8%A9%B1%E5%9B%9E%E5%BB%8A");
  });

  it("수정에서는 자기 곡 id를 함께 보낸다", async () => {
    fetchMock.mockResolvedValue(json({ duplicate: false, songId: null, title: null }));
    renderNotice("원래 곡명", 7);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain("excludeSongId=7");
  });

  it("중복이 아니면 아무것도 보이지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ duplicate: false, songId: null, title: null }));
    renderNotice("새 곡");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("비어 있으면 서버에 묻지 않는다", async () => {
    renderNotice("   ");
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("글자를 계속 치는 동안에는 묻지 않고, 멈추면 마지막 값으로 묻는다", async () => {
    fetchMock.mockResolvedValue(json({ duplicate: false, songId: null, title: null }));
    const { setTitle } = renderNotice("a"); // 처음 값은 바로 확인한다(수정 창은 이미 채워진 곡명으로 열린다)
    setTitle("ab");
    setTitle("abc");

    await waitFor(() => expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain("/api/v1/songs/title-check?title=abc"));
    // 중간 값("ab")은 묻지 않았다
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("/api/v1/songs/title-check?title=ab");
  });

  it("확인에 실패하면 조용히 아무것도 보이지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL_ERROR", message: "x", timestamp: "t" }, 500));
    renderNotice("새 곡");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
