import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongMetaView } from "@/components/admin/SongMetaView";
import { ToastProvider } from "@/components/Toast";
import type { SongDetailResponse } from "@/lib/api-types";
import type { SongMetaRow, SongMetaTodoResponse } from "@/lib/song-meta";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/admin/song-meta" }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const row = (songId: number, title: string, over: Partial<SongMetaRow> = {}): SongMetaRow => ({
  songId, title, artist: null, titleCount: 0, topPart: "GUITAR", topDifficulty: "MASTER", topLevel: 9.8, ...over,
});

function todo(rows: SongMetaRow[], anyMissing = rows.length): SongMetaTodoResponse {
  return {
    summary: { totalSongs: 519, noArtist: 37, noKeyword: 112, bothMissing: 21, anyMissing },
    page: { content: rows, page: 0, size: 20, totalElements: rows.length, totalPages: 1 },
  };
}

const detailOf = (id: number, title: string): SongDetailResponse => ({
  id, title, artist: null, addedVersion: "V8", titleFolder: null, bpmMin: null, bpmMax: null, source: null, titles: [], difficulties: [],
});

/** 폭에 따라 데스크톱(true)/모바일(false)을 돌려주는 matchMedia 대역 */
function stubViewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("1024") ? desktop : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("곡 정보 정리 화면 (D91)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);
  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <SongMetaView viewerId={1} />
        </ToastProvider>
      </QueryClientProvider>,
    );

  it("칩에 건수가 보이고, 칩을 누르면 그 조건(filter)으로 다시 요청한다", async () => {
    stubViewport(true);
    fetchMock.mockResolvedValue(json(todo([row(1, "Peyotl")], 128)));
    renderView();
    const group = within(await screen.findByRole("group", { name: "미등록 종류" }));
    expect(await group.findByRole("button", { name: /전체 미등록\s*128/ })).toHaveAttribute("aria-pressed", "true");
    expect(group.getByRole("button", { name: /아티스트 없음\s*37/ })).toBeInTheDocument();
    expect(group.getByRole("button", { name: /검색 키워드 없음\s*112/ })).toBeInTheDocument();

    fireEvent.click(group.getByRole("button", { name: /둘 다\s*21/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("filter=BOTH"))).toBe(true));
    expect(String(fetchMock.mock.calls[0][0])).toContain("/admin/song-meta/todo");
    expect(String(fetchMock.mock.calls[0][0])).toContain("filter=ANY");
    expect(String(fetchMock.mock.calls[0][0])).toContain("size=20");
  });

  it("데스크톱: 줄에서 바로 아티스트를 입력해 저장하면 최신 상세를 읽고 PUT 하며, 되돌리기 안내가 뜬다", async () => {
    stubViewport(true);
    let saved = false;
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/admin/song-meta/todo")) return Promise.resolve(json(saved ? todo([], 127) : todo([row(1, "Peyotl", { titleCount: 2 })], 128)));
      if (url.endsWith("/songs/1") && init?.method === "PUT") {
        saved = true;
        return Promise.resolve(json(detailOf(1, "Peyotl")));
      }
      if (url.endsWith("/songs/1")) return Promise.resolve(json(detailOf(1, "Peyotl")));
      return Promise.resolve(json({}, 404));
    });
    renderView();
    const save = await screen.findByRole("button", { name: "Peyotl 저장" });
    expect(save).toBeDisabled(); // 아무것도 입력하지 않으면 저장할 수 없다
    expect(screen.getByText("Guitar | MAS 9.80")).toBeInTheDocument();
    expect(screen.getByText("등록됨")).toBeInTheDocument(); // 키워드는 이미 있는 줄

    fireEvent.change(screen.getByLabelText("Peyotl 아티스트"), { target: { value: " Yusuke Kitaura " } });
    fireEvent.click(save);

    expect(await screen.findByTestId("song-meta-notice")).toHaveTextContent("Peyotl 저장됨 · 남은 미등록 127곡");
    const put = calls("PUT")[0];
    expect(String(put[0])).toContain("/songs/1");
    expect(JSON.parse(String(put[1]?.body))).toMatchObject({ title: "Peyotl", artist: "Yusuke Kitaura", addedVersion: "V8" });
    // 조건이 풀린 곡은 목록에서 사라진다
    await waitFor(() => expect(screen.queryByRole("button", { name: "Peyotl 저장" })).toBeNull());
  });

  it("되돌리기를 누르면 저장 직전 값으로 다시 PUT 하고 안내가 사라진다", async () => {
    stubViewport(true);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/admin/song-meta/todo")) return Promise.resolve(json(todo([row(1, "Peyotl")], 1)));
      if (url.endsWith("/songs/1")) return Promise.resolve(json(detailOf(1, "Peyotl")));
      return Promise.resolve(json({}, 404));
    });
    renderView();
    fireEvent.change(await screen.findByLabelText("Peyotl 아티스트"), { target: { value: "Yusuke" } });
    fireEvent.change(screen.getByLabelText("Peyotl 로마자 검색 키워드"), { target: { value: "peyotl" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText("peyotl")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Peyotl 저장" }));

    fireEvent.click(await screen.findByRole("button", { name: "Peyotl 저장 되돌리기" }));
    await waitFor(() => expect(calls("PUT")).toHaveLength(2));
    const [first, second] = calls("PUT").map(([, init]) => JSON.parse(String(init?.body)));
    expect(first.titles).toEqual([{ kind: "ROMAJI", title: "peyotl" }]);
    expect(second.artist).toBeNull(); // 저장 직전: 아티스트 없음
    expect(second.titles).toEqual([]); // 이번 저장이 넣은 키워드를 지운다
    await waitFor(() => expect(screen.queryByTestId("song-meta-notice")).toBeNull());
  });

  it("모바일: 줄을 눌러 펼치면 비어 있는 칸만 입력창이 나오고, 취소하면 접힌다", async () => {
    stubViewport(false);
    fetchMock.mockResolvedValue(json(todo([row(1, "Peyotl", { titleCount: 1 }), row(2, "blue moon", { artist: "A" })])));
    renderView();
    const head = await screen.findByRole("button", { name: "Peyotl 펼치기" });
    expect(screen.getByText("아티스트 없음", { selector: "span.rounded-full" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Peyotl 아티스트")).toBeNull();

    fireEvent.click(head);
    expect(head).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Peyotl 아티스트")).toBeInTheDocument();
    expect(screen.queryByLabelText("Peyotl 로마자 검색 키워드")).toBeNull(); // 키워드는 이미 있다

    // 다른 줄을 열면 앞의 줄은 접힌다(한 번에 하나)
    fireEvent.click(screen.getByRole("button", { name: "blue moon 펼치기" }));
    expect(screen.queryByLabelText("Peyotl 아티스트")).toBeNull();
    expect(screen.getByLabelText("blue moon 로마자 검색 키워드")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByLabelText("blue moon 로마자 검색 키워드")).toBeNull();
  });

  it("저장이 실패하면 줄에 오류를 보이고 되돌리기 안내는 뜨지 않는다", async () => {
    stubViewport(true);
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/admin/song-meta/todo")) return Promise.resolve(json(todo([row(1, "Peyotl")])));
      if (url.endsWith("/songs/1") && init?.method === "PUT") return Promise.resolve(json({ code: "NOT_FOUND", message: "찾을 수 없습니다." }, 404));
      return Promise.resolve(json(detailOf(1, "Peyotl")));
    });
    renderView();
    fireEvent.change(await screen.findByLabelText("Peyotl 아티스트"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Peyotl 저장" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId("song-meta-notice")).toBeNull();
  });

  it("목록이 비면 안내 문구를 보인다", async () => {
    stubViewport(true);
    fetchMock.mockResolvedValue(json(todo([], 0)));
    renderView();
    expect(await screen.findByText("정리할 곡이 없습니다.")).toBeInTheDocument();
  });
});
