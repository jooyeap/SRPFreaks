import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserResponse } from "@/lib/api-types";
import { GlobalSongSearch } from "@/components/search/GlobalSongSearch";
import type { ChartRowResponse, PageResponse } from "@/lib/api-types";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function row(id: number, title: string): ChartRowResponse {
  return { songDifficultyId: id, songId: id + 100, title, addedVersion: "V5", part: "GUITAR", difficulty: "MASTER", level: 9.6, mine: null };
}

function page(content: ChartRowResponse[], totalElements = content.length): PageResponse<ChartRowResponse> {
  return { content, page: 0, size: 8, totalElements, totalPages: 1 };
}

// 로그인 상태와 현재 주소만 바꿔 가며 확인한다 (AuthProvider의 실제 네트워크 복구는 쓰지 않는다)
const auth: { user: UserResponse | null } = { user: null };
let pathname = "/";
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

/** 헤더에 들어가는 전역 곡 검색. 실제로는 SiteHeader가 그린다 */
function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // 같은 요소 객체를 다시 넘기면 React가 다시 그리지 않아서, 호출할 때마다 새로 만든다
  const ui = () => (
    <QueryClientProvider client={client}>
      <header>
        <GlobalSongSearch />
      </header>
    </QueryClientProvider>
  );
  const view = render(ui());
  return {
    view,
    rerenderAt: (path: string) => {
      pathname = path;
      view.rerender(ui());
    },
    openButton: () => screen.findByRole("button", { name: "곡 검색" }),
  };
}

async function type(text: string) {
  fireEvent.change(await screen.findByRole("searchbox", { name: "곡 검색" }), { target: { value: text } });
}

describe("전역 곡 검색 (헤더 진입점 + 오버레이, D100·D107)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    auth.user = null;
    pathname = "/";
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("헤더에 검색 버튼이 있다 (aria-label, aria-haspopup, 터치 영역 44px). 열기 전에는 검색창이 없다", async () => {
    const { openButton } = renderSearch();
    const button = await openButton();
    expect(button).toHaveAttribute("aria-label", "곡 검색");
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("w-11");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("누르면 검색 창이 열리고 입력칸에 포커스가 간다", async () => {
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    expect(await screen.findByRole("dialog", { name: "곡 검색" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "곡 검색" })).toHaveFocus();
    // 헤더(whitespace-nowrap) 안에 그려지므로 줄바꿈 규칙을 되돌려 놓는다(안내 문장이 잘리지 않게)
    expect(screen.getByRole("dialog")).toHaveClass("whitespace-normal");
    expect(screen.getByText(/곡명이나 아티스트를 입력해 주세요/)).toBeInTheDocument();
  });

  it("입력하면 곡 목록과 같은 API로 찾고, 결과를 누르면 곡 상세로 가는 링크다 (비로그인도 같다)", async () => {
    fetchMock.mockResolvedValue(json(page([row(1, "Prog for your Soul"), row(2, "Prog Rock")])));
    const { openButton } = renderSearch();
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

  it("lg 이상에서는 검색창처럼 보이는 버튼이 된다 (폭 260px, 안내 글자 `곡명·아티스트 검색`, 진짜 입력칸은 아니다)", async () => {
    const { openButton } = renderSearch();
    const button = await openButton();
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toContain("lg:w-[260px]");
    expect(button).toHaveTextContent("곡명·아티스트 검색");
    // 안내 글자는 lg 미만에서는 숨는다(아이콘만)
    expect(button.querySelector("span")?.className).toContain("hidden");
    expect(button.querySelector("span")?.className).toContain("lg:inline");
    expect(screen.queryByRole("searchbox")).toBeNull();
    // 버튼은 하나뿐이다(폭에 따라 모양만 바뀐다)
    expect(screen.getAllByRole("button", { name: "곡 검색" })).toHaveLength(1);
  });

  it("로그인 전(userId 0)·후 모두 같은 자리의 같은 버튼이다", async () => {
    auth.user = { id: 7, email: "a@b.c", nickname: "홍길동", role: "USER" } as UserResponse;
    fetchMock.mockResolvedValue(json(page([row(1, "Alpha")])));
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    await type("alpha");
    expect(await screen.findByRole("link", { name: /Alpha/ })).toBeInTheDocument();
  });

  it("닫으면(버튼·Esc) 포커스가 검색 버튼으로 돌아온다", async () => {
    const { openButton } = renderSearch();
    const button = await openButton();
    fireEvent.click(button);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(button).toHaveFocus();
  });

  it("주소가 바뀌면 열린 창이 닫힌다 (헤더는 화면을 옮겨도 남아 있다)", async () => {
    const { openButton, rerenderAt } = renderSearch();
    fireEvent.click(await openButton());
    await screen.findByRole("dialog");
    rerenderAt("/songs/5");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("결과(링크)를 누르면 창이 닫힌다 (같은 주소로 가는 링크도 포함)", async () => {
    fetchMock.mockResolvedValue(json(page([row(1, "Alpha")], 30)));
    const { openButton } = renderSearch();
    fireEvent.click(await openButton());
    await type("alpha");
    const link = await screen.findByRole("link", { name: "곡 목록에서 모두 보기" });
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
