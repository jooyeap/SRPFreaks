import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDetailNav } from "@/components/song/use-detail-nav";
import type { ChartRowResponse, PageResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { rememberDetailNav, resetDetailNavForTest } from "@/lib/detail-nav";
import { EMPTY_FILTERS } from "@/lib/difficulty-table";
import { EMPTY_SONG_FILTERS } from "@/lib/song-list";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }) }));

function entry(id: number): TableEntryResponse {
  return {
    entryId: id, songDifficultyId: id, songId: id * 10, title: `t${id}`, addedVersion: "V5", part: "GUITAR", difficulty: "MASTER", level: 9, tierUncertain: false,
    recommend: "상", recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true, mine: null,
  };
}
const groups: TierGroupResponse[] = [
  { tier: 5.3, total: 3, recorded: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries: [entry(1), entry(2), entry(3)] },
];

function Harness({ origin = "table", chartId = 2, swipeEnabled = true }: { origin?: "table" | "songs"; chartId?: number; swipeEnabled?: boolean }) {
  const nav = useDetailNav({ origin, chartId, userId: 1, groups, swipeEnabled });
  return (
    <div data-testid="area" {...nav.swipe}>
      <span data-testid="pos">{nav.view ? `${nav.view.position}/${nav.view.total}` : "none"}</span>
      <input data-testid="input" />
      <div data-testid="scroller" style={{ overflowX: "auto" }} />
      <dialog data-testid="dlg" open>
        <span data-testid="indlg" />
      </dialog>
    </div>
  );
}

function renderHarness(props: Parameters<typeof Harness>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

function swipe(el: Element, dx: number, dy = 0, startX = 200) {
  fireEvent.touchStart(el, { touches: [{ clientX: startX, clientY: 300 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: startX + dx, clientY: 300 + dy }] });
}

describe("useDetailNav", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    resetDetailNavForTest();
    window.scrollTo = vi.fn();
    rememberDetailNav({ source: "table", sort: "level", filters: EMPTY_FILTERS, current: 2 });
    // 열린 창 검사는 DOM 전체를 보므로 기본 테스트에서는 harness의 dialog를 닫아 둔다
    document.querySelectorAll("dialog[open]").forEach((d) => d.removeAttribute("open"));
  });
  afterEach(() => resetDetailNavForTest());

  function area() {
    const el = screen.getByTestId("area");
    el.querySelector("dialog")?.removeAttribute("open");
    return el;
  }

  it("맥락이 있으면 위치가 나오고, 없으면 none이다", () => {
    renderHarness();
    expect(screen.getByTestId("pos")).toHaveTextContent("2/3");
  });
  it("맥락이 없으면 바 없음(view 없음)이고 스와이프도 무반응이다", () => {
    resetDetailNavForTest();
    renderHarness();
    expect(screen.getByTestId("pos")).toHaveTextContent("none");
    swipe(area(), -100);
    expect(replaceMock).not.toHaveBeenCalled();
  });
  it("왼쪽으로 80px 이상 밀면 다음 곡, 오른쪽이면 이전 곡으로 replace 이동한다", () => {
    renderHarness();
    swipe(area(), -80);
    expect(replaceMock).toHaveBeenLastCalledWith("/songs/30?from=table&chart=3");
    rememberDetailNav({ source: "table", sort: "level", filters: EMPTY_FILTERS, current: 2 });
    swipe(area(), 80);
    expect(replaceMock).toHaveBeenLastCalledWith("/songs/10?from=table&chart=1");
  });
  it("79px 이하, 30° 바깥은 이동하지 않는다", () => {
    renderHarness();
    swipe(area(), -79);
    swipe(area(), -100, 58);
    expect(replaceMock).not.toHaveBeenCalled();
  });
  it("가장자리 24px 안에서 시작한 밀기는 무시한다 (왼쪽 끝, 오른쪽 끝)", () => {
    renderHarness();
    swipe(area(), 100, 0, 23);
    swipe(area(), -100, 0, window.innerWidth - 23);
    expect(replaceMock).not.toHaveBeenCalled();
    swipe(area(), 100, 0, 24);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
  it("입력 칸, 가로 스크롤 영역에서 시작한 밀기는 무시한다", () => {
    renderHarness();
    const scroller = screen.getByTestId("scroller");
    Object.defineProperty(scroller, "scrollWidth", { value: 500 });
    Object.defineProperty(scroller, "clientWidth", { value: 100 });
    swipe(screen.getByTestId("input"), -100);
    swipe(scroller, -100);
    expect(replaceMock).not.toHaveBeenCalled();
  });
  it("열린 창(기록 입력 창 등)이 있으면 창 안에서도 밖에서도 끈다", () => {
    renderHarness();
    const el = screen.getByTestId("area");
    el.querySelector("dialog")?.setAttribute("open", "");
    swipe(screen.getByTestId("indlg"), -100);
    swipe(el, -100);
    expect(replaceMock).not.toHaveBeenCalled();
  });
  it("화면이 끄라고 하면(swipeEnabled=false) 이동하지 않는다", () => {
    renderHarness({ swipeEnabled: false });
    swipe(area(), -100);
    expect(replaceMock).not.toHaveBeenCalled();
  });
  it("처음/끝에서는 이동하지 않는다", () => {
    rememberDetailNav({ source: "table", sort: "level", filters: EMPTY_FILTERS, current: 3 });
    renderHarness({ chartId: 3 });
    swipe(area(), -100); // 마지막 채보에서 다음
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("useDetailNav (곡 목록)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const row = (id: number) => ({ songDifficultyId: id, songId: id * 10 }) as ChartRowResponse;
  const page = (n: number, ids: number[]): PageResponse<ChartRowResponse> => ({ content: ids.map(row), page: n, size: 2, totalElements: 4, totalPages: 2 });

  beforeEach(() => {
    replaceMock.mockReset();
    resetDetailNavForTest();
    window.scrollTo = vi.fn();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input) => {
      const p = new URL(String(input), "http://x").searchParams.get("page");
      return Promise.resolve(new Response(JSON.stringify(p === "0" ? page(0, [1, 2]) : page(1, [3, 4])), { headers: { "Content-Type": "application/json" } }));
    });
    rememberDetailNav({ source: "songs", userId: 1, lo: 9.5, step: "0.50", filters: EMPTY_SONG_FILTERS, size: 2, current: 2 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("받은 끝에서 다음은 다음 페이지를 받아 그 첫 곡으로 간다", async () => {
    renderHarness({ origin: "songs", chartId: 2 });
    await waitFor(() => expect(screen.getByTestId("pos")).toHaveTextContent("2/4"));
    await act(async () => {
      const el = screen.getByTestId("area");
      el.querySelector("dialog")?.removeAttribute("open"); // 열린 창이 없는 상태
      swipe(el, -100);
    });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/songs/30?from=songs&chart=3"));
  });
});
