import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JacketImportPanel } from "@/components/admin/JacketImportPanel";
import { MSG_DONE, MSG_IMAGE, MSG_READY, MSG_TITLES, MSG_WANT, OFFICIAL_ORIGIN } from "@/lib/jacket-reader";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("JacketImportPanel (D54)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let opener: Window;
  let posted: unknown[];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // 공식 창 대신 iframe의 창을 opener로 쓴다(MessageEvent의 source는 실제 Window여야 한다)
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    opener = frame.contentWindow as Window;
    posted = [];
    opener.postMessage = ((message: unknown) => {
      posted.push(message);
    }) as Window["postMessage"];
    Object.defineProperty(window, "opener", { value: opener, configurable: true });
    window.history.replaceState(null, "", "/admin/song-import?jacket=1");
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "opener", { value: null, configurable: true });
    window.history.replaceState(null, "", "/");
  });

  function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <JacketImportPanel />
      </QueryClientProvider>,
    );
  }

  function send(data: unknown, origin = OFFICIAL_ORIGIN, source: Window = opener) {
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
    });
  }

  it("준비 신호를 보내고, 곡명을 받으면 매칭해서 맞은 곡명만 돌려보낸 뒤 받은 재킷을 미리보기·저장한다", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/admin/song-jackets/match")) {
        return json({
          matches: [
            { officialTitle: "Alpha", songId: 1, songTitle: "Alpha", hasJacket: false },
            { officialTitle: "Beta", songId: 2, songTitle: "Beta", hasJacket: true },
          ],
          unmatchedCount: 5,
          missingSongs: [{ songId: 9, title: "Gamma" }],
        });
      }
      return json({ saved: 1, replaced: 0 });
    });
    renderPanel();
    expect(posted).toContainEqual({ type: MSG_READY });

    send({ type: MSG_TITLES, titles: ["Alpha", "Beta", "Other"], failedPages: 0 });
    await waitFor(() => expect(posted).toContainEqual({ type: MSG_WANT, titles: ["Alpha", "Beta"] }));
    expect(await screen.findByText("맞은 곡 2곡 · 마스터에 없음 5곡 · 공식 목록에 없음 1곡")).toBeInTheDocument();

    send({ type: MSG_IMAGE, title: "Alpha", data: new ArrayBuffer(8) });
    send({ type: MSG_IMAGE, title: "Beta", data: new ArrayBuffer(8) });
    send({ type: MSG_IMAGE, title: "Nope", data: new ArrayBuffer(8) }); // 요청하지 않은 곡명은 버린다
    send({ type: MSG_DONE, sent: 2, failed: 1 });

    const alpha = await screen.findByRole("checkbox", { name: /Alpha/ });
    const beta = screen.getByRole("checkbox", { name: /Beta/ });
    expect(alpha).toBeChecked(); // 새로 넣기는 기본 체크
    expect(beta).not.toBeChecked(); // 교체 후보는 기본 해제
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("재킷 2장을 받았습니다. (실패 1장)");

    fireEvent.click(screen.getByRole("button", { name: "체크한 1곡 저장" }));
    await waitFor(() => expect(screen.getByText("저장 결과: 새로 1곡, 교체 0곡")).toBeInTheDocument());
    const saveCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/admin/song-jackets"));
    const form = saveCall?.[1]?.body as FormData;
    expect(form.getAll("songIds")).toEqual(["1"]);
    expect((form.get("images") as File).type).toBe("image/webp");
  });

  it("공식 사이트가 아닌 출처나 다른 창에서 온 메시지는 무시한다", async () => {
    renderPanel();
    send({ type: MSG_TITLES, titles: ["Alpha"], failedPages: 0 }, "https://evil.example");
    send({ type: MSG_TITLES, titles: ["Alpha"], failedPages: 0 }, OFFICIAL_ORIGIN, window);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("북마클릿이 연 창이 아니면 북마크 안내를 보여 준다", () => {
    Object.defineProperty(window, "opener", { value: null, configurable: true });
    renderPanel();
    expect(screen.getByText("SRP 재킷")).toBeInTheDocument();
    expect(posted).toEqual([]);
  });
});
