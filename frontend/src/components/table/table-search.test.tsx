import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TableSearch } from "@/components/table/TableSearch";
import type { ChartRowResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

function entry(over: Partial<TableEntryResponse>): TableEntryResponse {
  return {
    entryId: 1,
    songDifficultyId: 10,
    songId: 100,
    title: "Alpha",
    addedVersion: null,
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend: null,
    recommendUncertain: false,
    pattern: null,
    patternUncertain: false,
    ratingEnabled: true,
    mine: null,
    ...over,
  };
}

const groups = [
  {
    tier: 6.0,
    entries: [entry({ songDifficultyId: 10, songId: 100, title: "Alpha", mine: { rate: 96.5, fullCombo: false, stage: "SS" } })],
  },
  { tier: null, entries: [entry({ entryId: 2, songDifficultyId: 12, songId: 102, title: "Gamma" })] },
] as unknown as TierGroupResponse[];

function row(songDifficultyId: number, songId: number, title: string): ChartRowResponse {
  return { songDifficultyId, songId, title, addedVersion: null, part: "GUITAR", difficulty: "MASTER", level: 9.5, mine: null };
}

function page(content: ChartRowResponse[], totalElements = content.length) {
  return new Response(JSON.stringify({ content, page: 0, size: 50, totalElements, totalPages: 1 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TableSearch", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderSearch(g: TierGroupResponse[] | undefined = groups) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <TableSearch userId={1} groups={g} />
      </QueryClientProvider>,
    );
  }
  const type = (value: string) => fireEvent.change(screen.getByLabelText("곡 검색어"), { target: { value } });

  it("검색창이 화면에 이미 있고, 좌측 하단 고정 버튼이 있으며, 입력하기 전에는 검색 요청을 하지 않는다", () => {
    renderSearch();
    expect(screen.getByLabelText("곡 검색어")).toBeInTheDocument(); // 누르지 않아도 바로 입력할 수 있다
    const button = screen.getByRole("button", { name: "곡 검색" });
    expect(button).toHaveClass("fixed");
    expect(button).toHaveClass("left-4");
    expect(screen.getByText(/곡명이나 아티스트를 입력하면/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("고정 버튼을 누르면 위쪽 검색창으로 포커스가 옮겨 가고 화면이 그쪽으로 스크롤된다", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderSearch();
    expect(screen.getByLabelText("곡 검색어")).not.toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "곡 검색" }));

    expect(screen.getByLabelText("곡 검색어")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    expect(screen.queryByRole("dialog")).toBeNull(); // 더 이상 팝업 창을 열지 않는다
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("검색어를 입력하면 서열표에 있는 채보만 레이팅 상수 난이도·내 기록과 함께 보여 준다", async () => {
    fetchMock.mockResolvedValue(page([row(10, 100, "Alpha"), row(999, 500, "서열표에 없는 곡")]));
    renderSearch();
    expect(screen.getByText(/곡명이나 아티스트를 입력하면/)).toBeInTheDocument();

    type("알파");
    const list = await screen.findByRole("list", { name: "검색 결과" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1); // 서열표에 없는 채보는 빠진다
    expect(items[0]).toHaveTextContent("Alpha");
    expect(items[0]).toHaveTextContent("레이팅 상수 난이도 6.0");
    expect(items[0]).toHaveTextContent("96.50");
    expect(within(items[0]).getByLabelText("달성 단계 SS")).toBeInTheDocument();
    // 곡 목록 검색 API를 검색어와 함께 한 번만 부른다 (입력 직후가 아니라 멈춘 뒤)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const params = new URL(String(fetchMock.mock.calls[0][0]), "http://x").searchParams;
    expect(params.get("q")).toBe("알파");
  });

  it("결과를 누르면 서열표 정보가 나오는 곡 상세로 가는 링크다", async () => {
    fetchMock.mockResolvedValue(page([row(10, 100, "Alpha")]));
    renderSearch();
    type("alpha");
    const link = await screen.findByRole("link", { name: /Alpha/ });
    expect(link).toHaveAttribute("href", "/songs/100?from=table&chart=10");
  });

  it("미정 묶음의 채보는 레이팅 상수 난이도를 미정으로 보여 준다", async () => {
    fetchMock.mockResolvedValue(page([row(12, 102, "Gamma")]));
    renderSearch();
    type("gamma");
    const item = await screen.findByRole("link", { name: /Gamma/ });
    expect(item).toHaveTextContent("레이팅 상수 난이도 미정");
  });

  it("서열표에서 찾지 못하면 안내와 곡 목록 검색 링크를 보여 준다", async () => {
    fetchMock.mockResolvedValue(page([row(999, 500, "서열표에 없는 곡")]));
    renderSearch();
    type("없는 곡");
    expect(await screen.findByText(/서열표에서 찾지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "곡 목록에서 검색" })).toHaveAttribute("href", "/songs?q=%EC%97%86%EB%8A%94%20%EA%B3%A1");
  });

  it("결과가 한 페이지를 넘으면 일부만 보인다고 알려 준다", async () => {
    fetchMock.mockResolvedValue(page([row(10, 100, "Alpha")], 120));
    renderSearch();
    type("a");
    expect(await screen.findByText(/일부만 보입니다/)).toBeInTheDocument();
  });

  it("공백만 입력하면 검색하지 않는다", async () => {
    renderSearch();
    type("   ");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/곡명이나 아티스트를 입력하면/)).toBeInTheDocument();
  });

  it("서버 오류는 서버가 준 문구로 알려 준다", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "BAD_REQUEST", message: "검색어가 너무 깁니다.", timestamp: "t" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    renderSearch();
    type("x");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("검색어가 너무 깁니다."));
  });

  it("입력을 지우면 결과가 사라지고 안내만 남는다", async () => {
    fetchMock.mockResolvedValue(page([row(10, 100, "Alpha")]));
    renderSearch();
    type("alpha");
    expect(await screen.findByRole("list", { name: "검색 결과" })).toBeInTheDocument();

    type("");
    await waitFor(() => expect(screen.queryByRole("list", { name: "검색 결과" })).toBeNull());
    expect(screen.getByText(/곡명이나 아티스트를 입력하면/)).toBeInTheDocument();
  });
});
