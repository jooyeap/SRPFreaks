import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartAddDialog } from "@/components/song/ChartAddDialog";
import type { SongChartResponse } from "@/lib/api-types";
import { availableCombos } from "@/lib/song-admin";

// 이 곡에는 Guitar MASTER / Guitar EXTREME / Bass MASTER가 이미 있다
const existing: SongChartResponse[] = [
  { id: 10, songId: 77, instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9.8, noteCount: null },
  { id: 11, songId: 77, instrumentPart: "GUITAR", difficultyType: "EXTREME", level: 7.2, noteCount: null },
  { id: 12, songId: 77, instrumentPart: "BASS", difficultyType: "MASTER", level: 8.5, noteCount: null },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("availableCombos", () => {
  it("이미 있는 (파트, 난이도)를 빼고, Guitar → Bass, 높은 난이도부터 돌려준다", () => {
    expect(availableCombos(existing).map((c) => `${c.part}|${c.difficulty}`)).toEqual([
      "GUITAR|ADVANCED",
      "GUITAR|BASIC",
      "BASS|EXTREME",
      "BASS|ADVANCED",
      "BASS|BASIC",
    ]);
  });

  it("8가지가 모두 있으면 빈 목록이다", () => {
    const all: SongChartResponse[] = (["GUITAR", "BASS"] as const).flatMap((part) =>
      (["BASIC", "ADVANCED", "EXTREME", "MASTER"] as const).map((difficultyType, i) => ({
        id: i, songId: 1, instrumentPart: part, difficultyType, level: 5, noteCount: null,
      })),
    );
    expect(availableCombos(all)).toEqual([]);
  });
});

describe("ChartAddDialog", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onClose = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    onClose.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderDialog(tableId: number | null) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ChartAddDialog open songId={77} existing={existing} tableId={tableId} onClose={onClose} />
      </QueryClientProvider>,
    );
  }
  const call = (i: number) => ({ url: String(fetchMock.mock.calls[i]?.[0]), init: fetchMock.mock.calls[i]?.[1] });
  const body = (i: number) => JSON.parse(String(fetchMock.mock.calls[i]?.[1]?.body)) as Record<string, unknown>;

  it("이미 있는 조합은 선택지에 없다", () => {
    renderDialog(null);
    const options = Array.from(screen.getByLabelText("파트·난이도").querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toHaveLength(5);
    expect(options).not.toContain("Guitar MAS");
  });

  it("서열표를 받지 못했으면(tableId 없음) 서열표 값 칸이 없고, 채보만 추가한다", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 99, songId: 77, instrumentPart: "GUITAR", difficultyType: "ADVANCED", level: 5.5, noteCount: null }, 201));
    renderDialog(null);
    expect(screen.queryByLabelText("레이팅 상수 난이도")).toBeNull();

    fireEvent.change(screen.getByLabelText("레벨"), { target: { value: "5.5" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(call(0).url).toContain("/songs/77/difficulties");
    expect(call(0).init?.method).toBe("POST");
    expect(body(0)).toEqual({ instrumentPart: "GUITAR", difficultyType: "ADVANCED", level: 5.5, noteCount: null });
  });

  it("서열표를 받았으면 고른 조합으로 채보를 만든 뒤 서열표 값도 저장한다", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 99, songId: 77, instrumentPart: "BASS", difficultyType: "EXTREME", level: 6.1, noteCount: null }, 201))
      .mockResolvedValueOnce(json({}));
    renderDialog(3);

    fireEvent.change(screen.getByLabelText("파트·난이도"), { target: { value: "2" } }); // Bass EXT
    fireEvent.change(screen.getByLabelText("레벨"), { target: { value: "6.1" } });
    fireEvent.change(screen.getByLabelText("레이팅 상수 난이도"), { target: { value: "4.5" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body(0)).toMatchObject({ instrumentPart: "BASS", difficultyType: "EXTREME", level: 6.1 });
    expect(call(1).url).toContain("/admin/difficulty-tables/3/entries/99");
    expect(call(1).init?.method).toBe("PUT");
    expect(body(1)).toMatchObject({ tierLabel: 4.5 });
  });

  it("서열표를 받았으면 레이팅 반영 체크가 기본 꺼짐으로 있고, 켜면 서열표 저장 본문에 true로 보낸다", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 99, songId: 77, instrumentPart: "GUITAR", difficultyType: "ADVANCED", level: 5.5, noteCount: null }, 201))
      .mockResolvedValueOnce(json({}));
    renderDialog(3);
    const check = screen.getByRole("checkbox", { name: "레이팅 반영" });
    expect(check).not.toBeChecked();
    fireEvent.click(check);
    fireEvent.change(screen.getByLabelText("레벨"), { target: { value: "5.5" } });
    fireEvent.change(screen.getByLabelText("레이팅 상수 난이도"), { target: { value: "4.5" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body(1)).toMatchObject({ tierLabel: 4.5, ratingEnabled: true });
  });

  it("서열표를 받지 못했으면(tableId 없음) 레이팅 반영 체크도 없다", () => {
    renderDialog(null);
    expect(screen.queryByRole("checkbox", { name: "레이팅 반영" })).toBeNull();
  });

  it("레벨을 비우면 보내지 않고 안내한다", async () => {
    renderDialog(null);
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("레벨");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("서버가 거절하면(같은 조합 동시 등록 등) 서버 메시지를 보여 주고 닫지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "CONFLICT", message: "이미 존재하는 데이터입니다.", timestamp: "t" }, 409));
    renderDialog(null);
    fireEvent.change(screen.getByLabelText("레벨"), { target: { value: "5.5" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByText("이미 존재하는 데이터입니다.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("채보는 만들어졌는데 서열표 저장이 실패하면 잠그고, 다시 누르면 채보를 또 만들지 않고 서열표 값만 보낸다", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 99, songId: 77, instrumentPart: "GUITAR", difficultyType: "ADVANCED", level: 5.5, noteCount: null }, 201))
      .mockResolvedValueOnce(json({ code: "INTERNAL_ERROR", message: "x", timestamp: "t" }, 500))
      .mockResolvedValueOnce(json({}));
    renderDialog(3);
    fireEvent.change(screen.getByLabelText("레벨"), { target: { value: "5.5" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByText(/채보는 추가됐지만/)).toBeInTheDocument();
    expect(screen.getByLabelText("레벨")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "서열표 값 다시 저장" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/songs/77/difficulties"))).toHaveLength(1);
  });
});
