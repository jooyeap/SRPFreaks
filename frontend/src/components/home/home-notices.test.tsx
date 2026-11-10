import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeNotices, NEW_NOTICE_DAYS, isNewNotice } from "@/components/home/HomeNotices";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const DAY = 24 * 60 * 60 * 1000;
/** 지금으로부터 daysAgo일 전에 올라온 공지. 날짜를 고정하면 시간이 지나 "새 공지" 조건이 깨지므로 지금 시각 기준으로 만든다 */
function notice(id: number, title: string, daysAgo: number) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  return { id, title, content: "본문은 홈에 보이지 않는다", createdAt: at, updatedAt: at };
}
const page = (content: ReturnType<typeof notice>[]) => ({ content, page: 0, size: 1, totalElements: content.length, totalPages: 1 });

describe("isNewNotice", () => {
  const now = Date.parse("2026-11-02T00:00:00Z");
  it("올린 지 7일 이내면 새 공지, 그보다 오래되면 아니다", () => {
    expect(NEW_NOTICE_DAYS).toBe(7);
    expect(isNewNotice("2026-10-26T00:00:00Z", now)).toBe(true); // 정확히 7일 전 = 경계는 새 공지
    expect(isNewNotice("2026-10-25T23:59:59Z", now)).toBe(false); // 7일하고 1초 전
    expect(isNewNotice("2026-11-02T00:00:00Z", now)).toBe(true);
  });
});

describe("HomeNotices", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <HomeNotices viewerId={1} />
      </QueryClientProvider>,
    );

  it("새 공지가 있으면 가장 최근 1건을 NEW와 제목·작성일로 보여 주고 본문은 보이지 않는다", async () => {
    fetchMock.mockResolvedValue(json(page([notice(3, "세 번째", 1)])));
    renderView();
    expect(await screen.findByText("세 번째")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("NEW")).toBeInTheDocument();
    expect(screen.queryByText("본문은 홈에 보이지 않는다")).toBeNull();
    // 1건만 요청한다
    expect(String(fetchMock.mock.calls[0][0])).toContain("size=1");
    expect(screen.getByRole("link", { name: /세 번째/ })).toHaveAttribute("href", "/notices/3");
    expect(screen.getByRole("link", { name: "전체 보기" })).toHaveAttribute("href", "/notices");
  });

  it("가장 최근 공지도 7일보다 오래됐으면 홈에 아무것도 그리지 않는다", async () => {
    fetchMock.mockResolvedValue(json(page([notice(1, "오래된 공지", 8)])));
    const { container } = renderView();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText("오래된 공지")).toBeNull();
  });

  it("공지가 없으면 안내도 없이 비워 둔다", async () => {
    fetchMock.mockResolvedValue(json(page([])));
    const { container } = renderView();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("불러오는 동안에는 비워 둔다 (없을 수 있는 칸이라 안내 글자를 깜빡이지 않는다)", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { container } = renderView();
    expect(container).toBeEmptyDOMElement();
  });

  it("불러오지 못하면 작은 안내만 보여 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL", message: "x", timestamp: "t" }, 500));
    renderView();
    expect(await screen.findByText("공지사항을 불러오지 못했습니다.")).toBeInTheDocument();
  });
});
