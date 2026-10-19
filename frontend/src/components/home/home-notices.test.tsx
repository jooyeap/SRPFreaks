import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeNotices } from "@/components/home/HomeNotices";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function notice(id: number, title: string) {
  return { id, title, content: "본문은 홈에 보이지 않는다", createdAt: "2026-10-18T15:30:00Z", updatedAt: "2026-10-18T15:30:00Z" };
}

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

  it("최근 공지 3건을 제목과 작성일(서울 날짜)로 보여 주고 본문은 보이지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ content: [notice(3, "세 번째"), notice(2, "두 번째"), notice(1, "첫 번째")], page: 0, size: 3, totalElements: 3, totalPages: 1 }));
    renderView();
    expect(await screen.findByText("세 번째")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // UTC 2026-10-18 15:30 = 서울 2026-10-19
    expect(screen.getAllByText("2026-10-19")).toHaveLength(3);
    expect(screen.queryByText("본문은 홈에 보이지 않는다")).toBeNull();
    // 3건만 요청한다
    expect(String(fetchMock.mock.calls[0][0])).toContain("size=3");
    expect(screen.getByRole("link", { name: /세 번째/ })).toHaveAttribute("href", "/notices/3");
  });

  it("공지가 없으면 안내만 보여 준다", async () => {
    fetchMock.mockResolvedValue(json({ content: [], page: 0, size: 3, totalElements: 0, totalPages: 0 }));
    renderView();
    expect(await screen.findByText("등록된 공지가 없습니다.")).toBeInTheDocument();
  });

  it("불러오지 못하면 작은 안내만 보여 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL", message: "x", timestamp: "t" }, 500));
    renderView();
    expect(await screen.findByText("공지사항을 불러오지 못했습니다.")).toBeInTheDocument();
  });
});
