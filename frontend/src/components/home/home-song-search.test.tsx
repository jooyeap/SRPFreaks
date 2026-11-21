import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeSongSearch } from "@/components/home/HomeSongSearch";
import type { ChartRowResponse, PageResponse } from "@/lib/api-types";
import { HEADER_HOME_SEARCH_SLOT_ID } from "@/lib/header-slots";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function row(id: number, title: string): ChartRowResponse {
  return { songDifficultyId: id, songId: id + 100, title, addedVersion: "V5", part: "GUITAR", difficulty: "MASTER", level: 9.6, mine: null };
}

function page(content: ChartRowResponse[], totalElements = content.length): PageResponse<ChartRowResponse> {
  return { content, page: 0, size: 8, totalElements, totalPages: 1 };
}

/** 헤더의 빈 자리(SiteHeader가 그린다) + 홈 검색. 실제로는 홈 화면이 HomeSongSearch를 그린다 */
function renderSearch(userId = 0) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <header>
        <span id={HEADER_HOME_SEARCH_SLOT_ID} data-testid="slot" />
      </header>
      <HomeSongSearch userId={userId} />
    </QueryClientProvider>,
  );
  const slot = screen.getByTestId("slot");
  return { slot, openButton: () => within(slot).findByRole("button", { name: "곡 검색" }) };
}

async function type(text: string) {
  fireEvent.change(await screen.findByRole("searchbox", { name: "곡 검색" }), { target: { value: text } });
}

describe("홈 곡 검색 (헤더 돋보기 + 오버레이, D100)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("헤더 자리에 돋보기 버튼을 넣는다 (aria-label, 터치 영역 44px). 열기 전에는 검색창이 없다", async () => {
    const { openButton } = renderSearch();
    const button = await openButton();
    expect(button).toHaveAttribute("aria-label", "곡 검색");
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("w-11");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("누르면 검색 창이 열리고 입력칸에 포커스가 간다", async () => {
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    expect(await screen.findByRole("dialog", { name: "곡 검색" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "곡 검색" })).toHaveFocus();
    expect(screen.getByText(/곡명이나 아티스트를 입력해 주세요/)).toBeInTheDocument();
  });

  it("입력하면 곡 목록과 같은 API로 찾고, 결과를 누르면 곡 상세로 가는 링크다 (비로그인도 같다)", async () => {
    fetchMock.mockResolvedValue(json(page([row(1, "Prog for your Soul"), row(2, "Prog Rock")])));
    const { openButton } = renderSearch(0);
    fireEvent.click(await openButton());
    await type("prog");
    const link = await screen.findByRole("link", { name: /Prog for your Soul/ });
    expect(link).toHaveAttribute("href", "/songs/101?from=songs&chart=1");
    expect(screen.getByRole("link", { name: /Prog Rock/ })).toBeInTheDocument();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/songs/charts");
    expect(url).toContain("q=prog");
    // 결과가 한 번에 다 보이면 "모두 보기" 링크는 없다
    expect(screen.queryByRole("link", { name: "곡 목록에서 모두 보기" })).toBeNull();
  });

  it("결과가 후보 수보다 많으면 곡 목록의 같은 검색으로 가는 링크를 둔다", async () => {
    fetchMock.mockResolvedValue(json(page([row(1, "Alpha")], 30)));
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    await type("a b");
    expect(await screen.findByRole("link", { name: "곡 목록에서 모두 보기" })).toHaveAttribute("href", "/songs?q=a%20b");
  });

  it("결과가 없으면 안내와 오타 보정 추천어를 보여 주고, 추천어를 누르면 그 곡명으로 다시 찾는다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/songs/suggest")) {
        return Promise.resolve(json([{ songId: 7, title: "Prog for your Soul", artist: "A", matchedText: "Prog for your Soul" }]));
      }
      return Promise.resolve(json(url.includes("q=Prog+for") || url.includes("q=Prog%20for") ? page([row(7, "Prog for your Soul")]) : page([])));
    });
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    await type("prog for yuor soul");
    expect(await screen.findByText("검색어에 맞는 곡이 없습니다.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Prog for your Soul" }));
    expect(await screen.findByRole("link", { name: /Prog for your Soul/ })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "곡 검색" })).toHaveValue("Prog for your Soul");
  });

  it("검색이 실패하면 안내와 다시 시도 버튼을 보여 준다", async () => {
    fetchMock.mockResolvedValue(json({ message: "오류" }, 500));
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    await type("prog");
    expect(await screen.findByRole("alert")).toHaveTextContent("곡을 검색하지 못했습니다.");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("닫기 버튼으로 닫으면 창이 사라지고 돌아온 돋보기로 다시 열 수 있다 (검색어는 비워진다)", async () => {
    fetchMock.mockResolvedValue(json(page([row(1, "Alpha")])));
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    await type("alpha");
    await screen.findByRole("link", { name: /Alpha/ });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(await openButton());
    expect(await screen.findByRole("searchbox", { name: "곡 검색" })).toHaveValue("");
  });

  it("Esc(cancel)로 닫힌다", async () => {
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    const dialog = await screen.findByRole("dialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("글자를 입력한 뒤에도 입력칸에서 Esc 한 번으로 닫힌다 (검색 입력칸의 기본 Esc는 글자 지우기라서 직접 처리한다)", async () => {
    fetchMock.mockResolvedValue(json(page([row(1, "Alpha")])));
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    await type("alpha");
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "곡 검색" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("바깥(배경) 누르기로 닫힌다. 안쪽을 누르면 닫히지 않는다", async () => {
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(screen.getByText(/곡명이나 아티스트를 입력해 주세요/));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("헤더 자리가 없는 화면에서는 아무것도 그리지 않는다", () => {
    const client = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={client}>
        <HomeSongSearch userId={0} />
      </QueryClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
