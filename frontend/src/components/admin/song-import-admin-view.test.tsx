import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongImportAdminView } from "@/components/admin/SongImportAdminView";
import { ToastProvider } from "@/components/Toast";
import { FRAGMENT_PREFIX, type ReadSong } from "@/lib/official-song-reader";
import type { SongImportPreview } from "@/lib/song-import";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const song = (title: string): ReadSong => ({ title, artist: "Artist", charts: [{ part: "G", levels: ["1", "2", "3", "9.15"] }] });

const PREVIEW: SongImportPreview = {
  readSongs: 3,
  matchedSongs: 2,
  unchangedSongs: 0,
  unmatchedCount: 1,
  unmatchedTitles: ["Unknown Song"],
  artistFills: [{ songId: 10, title: "Song A", officialArtist: "Artist X" }],
  artistMismatches: [{ songId: 11, title: "Song B", currentArtist: "Old", officialArtist: "New" }],
  levelChanges: [{ songDifficultyId: 100, songId: 10, title: "Song A", part: "GUITAR", difficultyType: "MASTER", currentLevel: 9, officialLevel: 9.15 }],
};

describe("공식 곡 목록 갱신 화면", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/admin/song-import");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <ToastProvider>
          <SongImportAdminView />
        </ToastProvider>
      </QueryClientProvider>,
    );

  const receive = (songs: ReadSong[]) => {
    window.history.replaceState(null, "", `/admin/song-import${FRAGMENT_PREFIX}${encodeURIComponent(JSON.stringify({ songs }))}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  it("처음에는 받은 곡이 없고 미리보기를 누를 수 없다", () => {
    renderView();
    expect(screen.getByText("아직 받은 곡이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "미리보기" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "관리로" })).toHaveAttribute("href", "/admin");
  });

  it("사용 방법은 3단계 카드로 나뉘고, 안내 문장은 그대로이며 복사 버튼은 1단계에 있다", () => {
    renderView();
    const guide = within(screen.getByRole("region", { name: "사용 방법" }));
    const steps = guide.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(within(steps[0]).getByRole("heading", { name: "북마크 만들기" })).toBeInTheDocument();
    expect(within(steps[1]).getByRole("heading", { name: "곡 목록 페이지에서 누르기" })).toBeInTheDocument();
    expect(within(steps[2]).getByRole("heading", { name: "미리보기 후 반영" })).toBeInTheDocument();
    // 문장 내용은 바꾸지 않았다
    expect(within(steps[0]).getByText("아래 이름의 링크를 북마크 바로 끌어 놓거나, 주소 복사 버튼으로 북마크를 만듭니다.")).toBeInTheDocument();
    expect(within(steps[1]).getByText(/이어뮤즈먼트의 곡 목록 페이지를 연 상태에서/)).toBeInTheDocument();
    expect(within(steps[2]).getByText(/이 창으로 값이 넘어오면/)).toBeInTheDocument();
    expect(within(steps[0]).getByRole("button", { name: "북마크 주소 복사" })).toBeInTheDocument();
    expect(within(steps[0]).getByRole("button", { name: "주소창용 코드 복사" })).toBeInTheDocument();
    expect(guide.getByText(/곡 정보를 읽는 것은 이 브라우저뿐/)).toBeInTheDocument();
  });

  it("주소 조각으로 받은 곡을 세고 주소에서 지운다", async () => {
    window.history.replaceState(null, "", `/admin/song-import${FRAGMENT_PREFIX}${encodeURIComponent(JSON.stringify({ songs: [song("A"), song("B")] }))}`);
    renderView();
    expect(await screen.findByText("2곡을 받았습니다.")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it("같은 탭에 다음 쪽이 오면 곡이 이어서 쌓인다", async () => {
    renderView();
    receive([song("A")]);
    expect(await screen.findByText("1곡을 받았습니다.")).toBeInTheDocument();
    receive([song("B")]);
    expect(await screen.findByText("2곡을 받았습니다.")).toBeInTheDocument();
  });

  it("읽을 수 없는 조각은 안내하고 곡을 쌓지 않는다", async () => {
    renderView();
    window.history.replaceState(null, "", `/admin/song-import${FRAGMENT_PREFIX}broken`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(await screen.findByText(/받은 값을 읽을 수 없습니다/)).toBeInTheDocument();
    expect(screen.getByText("아직 받은 곡이 없습니다.")).toBeInTheDocument();
  });

  it("미리보기는 받은 곡을 /admin/song-imports/preview로 보내 결과를 보여 준다(처음에는 모두 선택)", async () => {
    fetchMock.mockResolvedValueOnce(json(PREVIEW));
    renderView();
    receive([song("Song A")]);
    fireEvent.click(await screen.findByRole("button", { name: "미리보기" }));

    expect(await screen.findByText("아티스트 채우기 (1)")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/admin/song-imports/preview");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ songs: [song("Song A")] });
    expect(screen.getByLabelText("Song A → Artist X")).toBeChecked();
    expect(screen.getByLabelText("Song A · Guitar MAS · 9.00 → 9.15")).toBeChecked();
    // 이미 있는 아티스트와 다른 곡은 표시만 하고 선택할 수 없다
    const mismatch = screen.getByText("Song B: 현재 Old / 공식 New");
    expect(within(mismatch.closest("li") as HTMLElement).queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("마스터에 없어 제외한 곡 1곡")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택한 2건 반영" })).toBeEnabled();
  });

  it("고른 항목의 id만 /admin/song-imports/commit으로 보내고, 반영하면 받은 곡을 비운다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(PREVIEW))
      .mockResolvedValueOnce(json({ artistFilled: 0, levelChanged: 1, skipped: 0 }))
      .mockResolvedValue(json({ content: [], page: 0, size: 30, totalElements: 0, totalPages: 0 }));
    renderView();
    receive([song("Song A")]);
    fireEvent.click(await screen.findByRole("button", { name: "미리보기" }));
    fireEvent.click(await screen.findByLabelText("Song A → Artist X")); // 아티스트 채우기는 해제
    fireEvent.click(screen.getByRole("button", { name: "선택한 1건 반영" }));

    expect(await screen.findByText("아티스트 0건, 레벨 1건을 반영했습니다. (건너뜀 0건)")).toBeInTheDocument();
    const commitCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/admin/song-imports/commit"));
    expect(commitCall).toBeTruthy();
    expect(JSON.parse(String(commitCall?.[1]?.body))).toEqual({ songs: [song("Song A")], artistSongIds: [], levelChartIds: [100] });
    expect(screen.getByText("아직 받은 곡이 없습니다.")).toBeInTheDocument();
  });

  it("미리보기 뒤에 곡이 더 쌓이면 이전 결과를 숨기고 다시 미리보기를 하게 한다", async () => {
    fetchMock.mockResolvedValueOnce(json(PREVIEW));
    renderView();
    receive([song("Song A")]);
    fireEvent.click(await screen.findByRole("button", { name: "미리보기" }));
    expect(await screen.findByText("아티스트 채우기 (1)")).toBeInTheDocument();
    receive([song("Song B")]);
    await waitFor(() => expect(screen.queryByText("아티스트 채우기 (1)")).not.toBeInTheDocument());
  });

  it("바뀔 항목이 없으면 반영 버튼 없이 안내한다", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...PREVIEW, artistFills: [], levelChanges: [], artistMismatches: [] }));
    renderView();
    receive([song("Song A")]);
    fireEvent.click(await screen.findByRole("button", { name: "미리보기" }));
    expect(await screen.findByText("바뀔 항목이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /반영$/ })).toBeNull();
  });

  it("미리보기가 실패하면 안내한다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "INTERNAL_ERROR", message: "x" }, 500));
    renderView();
    receive([song("Song A")]);
    fireEvent.click(await screen.findByRole("button", { name: "미리보기" }));
    expect(await screen.findByText("미리보기를 하지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeInTheDocument();
  });
});
