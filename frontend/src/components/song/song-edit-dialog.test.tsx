import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongEditDialog, type SongEditTarget } from "@/components/song/SongEditDialog";
import type { SongChartResponse, SongDetailResponse } from "@/lib/api-types";

const chart: SongChartResponse = { id: 501, songId: 77, instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9.5, noteCount: 1200 };
const song: SongDetailResponse = {
  id: 77,
  title: "테스트곡",
  artist: "누군가",
  addedVersion: "V5",
  titleFolder: "ㅌ",
  bpmMin: 120,
  bpmMax: 180,
  source: "seed",
  titles: [{ kind: "ROMAJI", title: "TESUTO" }],
  difficulties: [chart],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("SongEditDialog", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onClose = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    onClose.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderDialog(target: SongEditTarget | null) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <SongEditDialog target={target} onClose={onClose} />
      </QueryClientProvider>,
    );
  }
  const body = () => JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;

  it("target이 없으면 그리지 않는다", () => {
    renderDialog(null);
    expect(screen.queryByLabelText("곡명")).toBeNull();
  });

  it("곡 정보 수정: 지금 값이 채워져 있고, 저장하면 화면에 없는 값(BPM·타이틀 폴더)은 그대로 보낸다", async () => {
    fetchMock.mockResolvedValueOnce(json(song));
    renderDialog({ kind: "song", song });
    expect(screen.getByLabelText("곡명")).toHaveValue("테스트곡");
    expect(screen.getByLabelText("버전")).toHaveValue("V5");

    fireEvent.change(screen.getByLabelText("곡명"), { target: { value: "  바뀐 곡  " } });
    fireEvent.change(screen.getByLabelText("아티스트"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/songs/77");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PUT");
    expect(body()).toEqual({ title: "바뀐 곡", artist: null, addedVersion: "V5", titleFolder: "ㅌ", bpmMin: 120, bpmMax: 180 });
    expect(body()).not.toHaveProperty("titles"); // 생략 = 서버가 곡명 표기를 그대로 둔다
  });

  it("검색 키워드를 추가하고 저장하면 별칭이 아닌 기존 표기와 함께 titles로 보낸다", async () => {
    fetchMock.mockResolvedValueOnce(json(song));
    renderDialog({ kind: "song", song });
    expect(screen.getByText("등록된 키워드가 없습니다.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("검색 키워드"), { target: { value: "  테곡 " } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(within(screen.getByRole("list", { name: "등록된 검색 키워드" })).getByText("테곡")).toBeInTheDocument();
    expect(screen.getByLabelText("검색 키워드")).toHaveValue(""); // 추가하면 입력칸을 비운다

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body().titles).toEqual([
      { kind: "ROMAJI", title: "TESUTO" },
      { kind: "ALIAS", title: "테곡" },
    ]);
  });

  it("입력칸에 쓰고 추가를 누르지 않아도 저장할 때 함께 들어가고, Enter는 저장이 아니라 추가다", async () => {
    fetchMock.mockResolvedValueOnce(json(song));
    renderDialog({ kind: "song", song });
    const input = screen.getByLabelText("검색 키워드");

    fireEvent.change(input, { target: { value: "첫째" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(fetchMock).not.toHaveBeenCalled(); // Enter로 저장되지 않는다
    expect(screen.getByText("첫째")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "둘째" } }); // 추가 버튼은 안 누른다
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body().titles).toEqual([
      { kind: "ROMAJI", title: "TESUTO" },
      { kind: "ALIAS", title: "첫째" },
      { kind: "ALIAS", title: "둘째" },
    ]);
  });

  it("등록된 키워드는 보이고 삭제할 수 있다. 중복은 안내하고 막는다", async () => {
    const withAlias = { ...song, titles: [...song.titles, { kind: "ALIAS" as const, title: "옛별칭" }] };
    fetchMock.mockResolvedValueOnce(json(withAlias));
    renderDialog({ kind: "song", song: withAlias });
    expect(screen.getByText("옛별칭")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("검색 키워드"), { target: { value: "옛별칭" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByRole("alert")).toHaveTextContent("이미 등록된 키워드입니다.");

    fireEvent.click(screen.getByRole("button", { name: "옛별칭 키워드 삭제" }));
    expect(screen.queryByText("옛별칭")).toBeNull();
    fireEvent.change(screen.getByLabelText("검색 키워드"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body().titles).toEqual([{ kind: "ROMAJI", title: "TESUTO" }]); // 별칭만 빠진다
  });

  it("곡명을 비우면 검사 문구가 나오고 서버를 부르지 않는다", async () => {
    renderDialog({ kind: "song", song });
    fireEvent.change(screen.getByLabelText("곡명"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("곡명을 입력해 주세요.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("채보 수정: 레벨이 채워져 있고 저장하면 노트 수를 그대로 보낸다", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...chart, level: 9.75 }));
    renderDialog({ kind: "chart", song, chart });
    expect(screen.getByLabelText("레벨")).toHaveValue("9.50");
    fireEvent.change(screen.getByLabelText("레벨"), { target: { value: "9.75" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/difficulties/501");
    expect(body()).toEqual({ level: 9.75, noteCount: 1200 });
  });

  it("레벨 형식이 틀리면 막는다", async () => {
    renderDialog({ kind: "chart", song, chart });
    fireEvent.change(screen.getByLabelText("레벨"), { target: { value: "10.5" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText(/0\.00 ~ 9\.99/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("서버 오류는 메시지로 보여 주고 창을 닫지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "NOT_FOUND", message: "곡을 찾을 수 없습니다." }, 404));
    renderDialog({ kind: "song", song });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("곡을 찾을 수 없습니다.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
