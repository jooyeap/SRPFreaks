import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemyWikiBpmPanel } from "@/components/admin/RemyWikiBpmPanel";
import { MSG_REMY_ACK, MSG_REMY_ROWS, REMY_ORIGIN } from "@/lib/remywiki-reader";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type Status = "FILL" | "OVERWRITE" | "UNCHANGED" | "NONE";
const row = (
  songId: number,
  title: string,
  status: Status,
  cur: [number | null, number | null],
  off: [number, number],
  artist: { current: string | null; official: string | null; status: Status } = { current: null, official: null, status: "NONE" },
) => ({
  officialTitle: title,
  songId,
  songTitle: title,
  artist,
  bpm: { currentMin: cur[0], currentMax: cur[1], officialMin: off[0], officialMax: off[1], status },
});

describe("RemyWikiBpmPanel (D94)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let remy: Window;
  let acks: unknown[];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // RemyWiki 창 대신 iframe의 창을 보낸 쪽으로 쓴다(MessageEvent의 source는 실제 Window여야 한다)
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    remy = frame.contentWindow as Window;
    acks = [];
    remy.postMessage = ((message: unknown, target: string) => {
      acks.push({ message, target });
    }) as Window["postMessage"];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <RemyWikiBpmPanel />
      </QueryClientProvider>,
    );
  }

  function send(data: unknown, origin = REMY_ORIGIN, source: Window | null = remy) {
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
    });
  }

  const message = (id: string, rows: { title: string; artist?: string; bpm: string }[], source = "AC_GD_EXCHAIN") => ({
    type: MSG_REMY_ROWS,
    id,
    source,
    invalid: 0,
    rows: rows.map((r) => ({ artist: "", ...r })),
  });

  function mockServer() {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/admin/song-info-imports/preview")) {
        return json({
          readSongs: 4,
          matchedSongs: 3,
          unmatchedCount: 1,
          rows: [
            row(1, "Alpha", "FILL", [null, null], [180, 180], { current: null, official: "Artist A", status: "FILL" }),
            row(2, "Beta", "OVERWRITE", [150, 150], [160, 170], { current: "Old Name", official: "New Name", status: "OVERWRITE" }),
            row(3, "Gamma", "UNCHANGED", [200, 200], [200, 200], { current: "G", official: "G", status: "UNCHANGED" }),
          ],
        });
      }
      if (url.endsWith("/admin/song-info-imports/commit")) {
        return json({ artistFilled: 1, artistOverwritten: 0, bpmFilled: 1, bpmOverwritten: 0, skipped: 0 });
      }
      return json({});
    });
  }

  it("RemyWiki가 보낸 곡을 받으면 답(ack)을 보내고 미리보기를 보여 준다. 새로 채움 항목만 기본 체크한다", async () => {
    mockServer();
    renderPanel();
    expect(screen.getByText("SRP 곡 정보")).toBeInTheDocument();
    send(message("m1", [
      { title: "Alpha", artist: "Artist A", bpm: "180" },
      { title: "Beta", artist: "New Name", bpm: "160-170" },
      { title: "Gamma", artist: "G", bpm: "200" },
      { title: "Unknown Song", bpm: "120" },
    ]));
    expect(acks).toEqual([{ message: { type: MSG_REMY_ACK, id: "m1" }, target: REMY_ORIGIN }]);

    expect(await screen.findByText("맞은 곡 3곡 · 일치 안 됨 1곡")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Alpha 아티스트" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Alpha BPM" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Beta 아티스트" })).not.toBeChecked(); // 덮어쓰기는 기본 해제
    expect(screen.getByRole("checkbox", { name: "Beta BPM" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Gamma 아티스트" })).toBeDisabled(); // 변경 없음은 고를 수 없다
    expect(screen.getByRole("checkbox", { name: "Gamma BPM" })).toBeDisabled();
    // 현재값 → 가져온 값을 나란히 보여 사용자가 판단한다
    expect(screen.getByText("Old Name →", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("New Name")).toBeInTheDocument();
    // 상태는 색이 아니라 글자로도 보인다
    expect(screen.getAllByText("새로 채움").length).toBeGreaterThan(0);
    expect(screen.getAllByText("덮어쓰기").length).toBeGreaterThan(0);
    expect(screen.getAllByText("변경 없음").length).toBeGreaterThan(0);
    expect(screen.getByText("Unknown Song", { exact: false })).toBeInTheDocument(); // 일치 안 된 곡명 목록
    expect(screen.getByRole("button", { name: "선택 2건 저장" })).toBeEnabled();

    // 서버로 가는 값: 아티스트도 BPM도 함께 간다
    const previewCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/preview"));
    expect(JSON.parse(String(previewCall?.[1]?.body)).songs).toContainEqual({ title: "Beta", artist: "New Name", bpm: "160-170" });
  });

  it("체크한 항목만 저장하고, 덮어쓰기는 체크한 항목만 보낸다", async () => {
    mockServer();
    renderPanel();
    send(message("m1", [{ title: "Alpha", artist: "Artist A", bpm: "180" }, { title: "Beta", artist: "New Name", bpm: "160-170" }, { title: "Gamma", artist: "G", bpm: "200" }]));
    await screen.findByRole("checkbox", { name: "Alpha BPM" });

    fireEvent.click(screen.getByRole("button", { name: "덮어쓰기 2건 선택" }));
    expect(screen.getByRole("checkbox", { name: "Beta 아티스트" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Beta BPM" })).toBeChecked();
    expect(screen.getByRole("button", { name: "덮어쓰기 2건 제외" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "덮어쓰기 2건 제외" }));
    expect(screen.getByRole("checkbox", { name: "Beta BPM" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "선택 2건 저장" }));
    await waitFor(() => expect(screen.getByText(/저장 결과: 아티스트 새로 1곡·덮어쓰기 0곡, BPM 새로 1곡·덮어쓰기 0곡/)).toBeInTheDocument());
    const commitCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/commit"));
    expect(JSON.parse(String(commitCall?.[1]?.body))).toEqual({
      songs: [{ title: "Alpha", artist: "Artist A", bpm: "180" }],
      selections: [{ songId: 1, artist: true, bpm: true }],
    });
  });

  it("덮어쓰기 항목을 하나만 체크하면 그 항목만 저장한다(같은 곡의 다른 항목은 건드리지 않는다)", async () => {
    mockServer();
    renderPanel();
    send(message("m1", [{ title: "Alpha", artist: "Artist A", bpm: "180" }, { title: "Beta", artist: "New Name", bpm: "160-170" }]));
    await screen.findByRole("checkbox", { name: "Beta BPM" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Beta BPM" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 3건 저장" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/commit"))).toBe(true));
    const commitCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/commit"));
    expect(JSON.parse(String(commitCall?.[1]?.body)).selections).toEqual([
      { songId: 1, artist: true, bpm: true },
      { songId: 2, artist: false, bpm: true },
    ]);
  });

  it("다른 출처나 창 참조가 없는 메시지, 모양이 틀린 메시지는 무시하고 답도 보내지 않는다", async () => {
    mockServer();
    renderPanel();
    send(message("x1", [{ title: "Alpha", bpm: "180" }]), "https://evil.example");
    send(message("x2", [{ title: "Alpha", bpm: "180" }]), "https://www.remywiki.com");
    send(message("x3", [{ title: "Alpha", bpm: "180" }]), REMY_ORIGIN, null);
    send({ type: MSG_REMY_ROWS, id: "x4", rows: "no" });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(acks).toEqual([]);
    expect(screen.getByText("받은 곡이 없습니다.")).toBeInTheDocument();
  });

  it("같은 메시지가 다시 와도 답은 보내되 한 번만 반영하고, 같은 곡명의 다른 BPM은 나중 값으로 바꿔 알린다", async () => {
    mockServer();
    renderPanel();
    send(message("m1", [{ title: "Alpha", bpm: "180" }]));
    send(message("m1", [{ title: "Alpha", bpm: "180" }])); // 북마클릿의 재전송
    await screen.findByRole("checkbox", { name: "Alpha BPM" });
    expect(acks).toHaveLength(2);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/preview"))).toHaveLength(1);

    send(message("m2", [{ title: "alpha", bpm: "190" }], "AC_GD_Matixx"));
    await waitFor(() => expect(screen.getByText(/나중에 받은 값으로 바꾼 곡이 1곡/)).toBeInTheDocument());
    const last = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/preview")).at(-1);
    expect(JSON.parse(String(last?.[1]?.body)).songs).toEqual([{ title: "alpha", artist: "", bpm: "190" }]);
    expect(screen.getByText(/받은 페이지: AC_GD_EXCHAIN · AC_GD_Matixx/)).toBeInTheDocument();
  });

  it("비교가 실패해도 화면이 멈추지 않고 오류 문구를 보여 준다", async () => {
    fetchMock.mockImplementation(async () => json({ message: "서버 오류" }, 500));
    renderPanel();
    send(message("m1", [{ title: "Alpha", bpm: "180" }]));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("비우기를 누르면 받은 곡과 미리보기가 사라지고 안내가 다시 보인다", async () => {
    mockServer();
    renderPanel();
    send(message("m1", [{ title: "Alpha", bpm: "180" }]));
    await screen.findByRole("checkbox", { name: "Alpha BPM" });
    fireEvent.click(screen.getByRole("button", { name: "비우기" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("받은 곡이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("SRP 곡 정보")).toBeInTheDocument();
  });
});
