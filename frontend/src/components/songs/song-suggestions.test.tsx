import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongSuggestions } from "@/components/songs/SongSuggestions";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("SongSuggestions", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderIt(query: string, onPick = vi.fn()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SongSuggestions query={query} onPick={onPick} />
      </QueryClientProvider>,
    );
    return onPick;
  }

  it("후보를 칩으로 보여 주고, 누르면 그 곡명을 넘긴다", async () => {
    fetchMock.mockResolvedValue(json([{ songId: 1, title: "Prog for your Soul", artist: "A", matchedText: "Prog for your Soul" }]));
    const onPick = renderIt("prog for yuor soul");
    fireEvent.click(await screen.findByRole("button", { name: "Prog for your Soul" }));
    expect(onPick).toHaveBeenCalledWith("Prog for your Soul");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/songs/suggest");
  });

  it("검색어가 2글자 미만이면 요청하지 않는다", () => {
    renderIt(" a ");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("후보가 없거나 실패하면 아무것도 그리지 않는다", async () => {
    fetchMock.mockResolvedValue(json([]));
    renderIt("zzzz");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("혹시 이 곡인가요?")).toBeNull();
  });

  it("서버 오류여도 화면을 깨지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ message: "오류" }, 500));
    renderIt("zzzz");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("혹시 이 곡인가요?")).toBeNull();
  });
});
