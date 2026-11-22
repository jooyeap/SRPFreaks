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
  songId, title, artist: null, bpmMin: 150, bpmMax: 150, titleCount: 0, topPart: "GUITAR", topDifficulty: "MASTER", topLevel: 9.8, ...over,
});

function todo(rows: SongMetaRow[], anyMissing = rows.length, noBpm = 64): SongMetaTodoResponse {
  return {
    summary: { totalSongs: 519, noArtist: 37, noKeyword: 112, bothMissing: 21, anyMissing, noBpm },
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

  describe("BPM 없음 (D105)", () => {
    const noBpmRow = (id: number, title: string, over: Partial<SongMetaRow> = {}) =>
      row(id, title, { artist: "Artist", titleCount: 1, bpmMin: null, bpmMax: null, ...over });

    it("BPM 없음 칩은 건수와 함께 보이고, 누르면 filter=BPM으로 요청하며 `전체 N곡 중 BPM 없음 M곡`을 보인다", async () => {
      stubViewport(true);
      fetchMock.mockImplementation((input) => {
        const url = String(input);
        return Promise.resolve(json(url.includes("filter=BPM") ? todo([noBpmRow(1, "Peyotl")], 128, 64) : todo([row(2, "x")], 128, 64)));
      });
      renderView();
      const group = within(await screen.findByRole("group", { name: "미등록 종류" }));
      const chip = await group.findByRole("button", { name: /BPM 없음\s*64/ });
      expect(screen.queryByTestId("song-meta-bpm-count")).toBeNull();

      fireEvent.click(chip);
      await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("filter=BPM"))).toBe(true));
      expect(await screen.findByTestId("song-meta-bpm-count")).toHaveTextContent("전체 519곡 중 BPM 없음 64곡");
      expect(await screen.findByLabelText("Peyotl 최소 BPM")).toBeInTheDocument();
    });

    it("페이지네이션: 여러 쪽이면 쪽 이동 버튼이 보이고 page를 바꿔 요청한다", async () => {
      stubViewport(true);
      const rows = Array.from({ length: 20 }, (_, i) => noBpmRow(i + 1, `곡${i + 1}`));
      fetchMock.mockResolvedValue(json({ ...todo(rows, 0, 45), page: { content: rows, page: 0, size: 20, totalElements: 45, totalPages: 3 } }));
      renderView();
      await screen.findByLabelText("곡1 최소 BPM");
      const next = screen.getAllByRole("button").find((b) => /다음|next|>|›/.test(`${b.getAttribute("aria-label") ?? ""}${b.textContent ?? ""}`));
      expect(next).toBeDefined();
      fireEvent.click(next as HTMLElement);
      await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("page=1"))).toBe(true));
    });

    it("곡 상세로 가는 링크가 줄마다 있다", async () => {
      stubViewport(true);
      fetchMock.mockResolvedValue(json(todo([noBpmRow(7, "Peyotl")], 1, 1)));
      renderView();
      expect(await screen.findByRole("link", { name: "Peyotl 곡 상세 열기" })).toHaveAttribute("href", "/songs/7");
    });

    it("최소만 입력해 저장하면 고정 BPM으로 PUT 한다(최신 상세 위에 BPM만 얹는다)", async () => {
      stubViewport(true);
      fetchMock.mockImplementation((input) => {
        const url = String(input);
        if (url.includes("/admin/song-meta/todo")) return Promise.resolve(json(todo([noBpmRow(1, "Peyotl")], 1, 1)));
        if (url.endsWith("/songs/1")) return Promise.resolve(json({ ...detailOf(1, "Peyotl"), artist: "Artist" }));
        return Promise.resolve(json({}, 404));
      });
      renderView();
      const save = await screen.findByRole("button", { name: "Peyotl 저장" });
      expect(save).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Peyotl 최소 BPM"), { target: { value: "172" } });
      fireEvent.click(save);

      expect(await screen.findByTestId("song-meta-notice")).toBeInTheDocument();
      expect(JSON.parse(String(calls("PUT")[0][1]?.body))).toMatchObject({ title: "Peyotl", artist: "Artist", bpmMin: 172, bpmMax: 172 });
    });

    it("범위로 저장할 수 있고, 잘못된 값은 안내만 보이고 서버에 보내지 않는다", async () => {
      stubViewport(true);
      fetchMock.mockImplementation((input) => {
        const url = String(input);
        if (url.includes("/admin/song-meta/todo")) return Promise.resolve(json(todo([noBpmRow(1, "Peyotl")], 1, 1)));
        return Promise.resolve(json({ ...detailOf(1, "Peyotl"), artist: "Artist" }));
      });
      renderView();
      const min = await screen.findByLabelText("Peyotl 최소 BPM");
      const max = screen.getByLabelText("Peyotl 최대 BPM");
      const save = screen.getByRole("button", { name: "Peyotl 저장" });

      fireEvent.change(min, { target: { value: "200" } });
      fireEvent.change(max, { target: { value: "100" } });
      fireEvent.click(save);
      expect(await screen.findByRole("alert")).toHaveTextContent("최소 BPM은 최대 BPM보다 클 수 없습니다.");
      fireEvent.change(min, { target: { value: "abc" } });
      fireEvent.click(save);
      expect(await screen.findByText("BPM은 숫자(정수)로 입력해 주세요.")).toBeInTheDocument();
      fireEvent.change(min, { target: { value: "" } });
      fireEvent.change(max, { target: { value: "180" } });
      fireEvent.click(save);
      expect(await screen.findByText("최소 BPM을 입력해 주세요.")).toBeInTheDocument();
      expect(calls("PUT")).toHaveLength(0);

      fireEvent.change(min, { target: { value: "120" } });
      fireEvent.change(max, { target: { value: "180" } });
      fireEvent.click(save);
      await waitFor(() => expect(calls("PUT")).toHaveLength(1));
      expect(JSON.parse(String(calls("PUT")[0][1]?.body))).toMatchObject({ bpmMin: 120, bpmMax: 180 });
    });

    it("모바일: 펼치면 BPM 입력과 곡 상세 링크가 나오고, BPM이 이미 있는 줄에는 BPM 입력이 없다", async () => {
      stubViewport(false);
      fetchMock.mockResolvedValue(json(todo([noBpmRow(1, "Peyotl"), row(2, "blue moon", { titleCount: 1 })], 2, 1)));
      renderView();
      fireEvent.click(await screen.findByRole("button", { name: "Peyotl 펼치기" }));
      expect(screen.getByLabelText("Peyotl 최소 BPM")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Peyotl 곡 상세 열기" })).toHaveAttribute("href", "/songs/1");
      fireEvent.click(screen.getByRole("button", { name: "blue moon 펼치기" }));
      expect(screen.queryByLabelText("blue moon 최소 BPM")).toBeNull();
    });
  });
});
