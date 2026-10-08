import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongDeleteControl } from "@/components/song/SongDeleteControl";

describe("SongDeleteControl", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onDeleted = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    onDeleted.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderControl(chartId: number | null = 501) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <SongDeleteControl songId={77} songTitle="테스트곡" chartId={chartId} chartLabel="Guitar MASTER" onDeleted={onDeleted} />
      </QueryClientProvider>,
    );
  }
  const call = (i: number) => ({ url: String(fetchMock.mock.calls[i]?.[0]), method: fetchMock.mock.calls[i]?.[1]?.method });

  it("누르자마자 지우지 않고 확인 문구를 먼저 보여 주며, 취소하면 서버를 부르지 않는다", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "곡 삭제" }));
    expect(screen.getByText(/'테스트곡' 곡과 모든 채보를 삭제할까요/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("button", { name: "곡 삭제" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("곡 삭제를 확인하면 DELETE /songs/{id}를 보내고 onDeleted('song')을 부른다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "곡 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("song"));
    expect(call(0).url).toContain("/songs/77");
    expect(call(0).method).toBe("DELETE");
  });

  it("채보 삭제는 DELETE /difficulties/{id}를 보낸다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "채보 삭제" }));
    expect(screen.getByText(/Guitar MASTER를 삭제할까요/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("chart"));
    expect(call(0).url).toContain("/difficulties/501");
  });

  it("채보가 없으면 채보 삭제 버튼을 숨긴다", () => {
    renderControl(null);
    expect(screen.queryByRole("button", { name: "채보 삭제" })).toBeNull();
    expect(screen.getByRole("button", { name: "곡 삭제" })).toBeInTheDocument();
  });

  it("서버가 실패하면 오류를 보여 주고 화면을 옮기지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "권한이 없습니다." }), { status: 403, headers: { "Content-Type": "application/json" } }),
    );
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "곡 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
