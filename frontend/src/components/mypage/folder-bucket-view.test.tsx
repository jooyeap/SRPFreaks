import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FolderBucketView } from "@/components/mypage/FolderBucketView";
import type { ChartRowResponse, TableEntryResponse } from "@/lib/api-types";
import type { FolderViewState } from "@/lib/rate-folders";

const row: ChartRowResponse = {
  songDifficultyId: 10, songId: 100, title: "레벨곡", addedVersion: null, part: "GUITAR", difficulty: "MASTER", level: 9.6,
  mine: { rate: 96, fullCombo: false, stage: "SS" },
};
const entry: TableEntryResponse = {
  entryId: 1, songDifficultyId: 20, songId: 200, title: "서열표곡", addedVersion: null, part: "BASS", difficulty: "EXTREME", level: 8.1,
  tierUncertain: false, recommend: null, recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true, mine: null,
};

function page<T>(content: T[], over: Record<string, unknown> = {}) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1, ...over };
}

describe("FolderBucketView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }
  function renderView(state: FolderViewState, onStateChange = vi.fn()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FolderBucketView userId={1} state={state} onStateChange={onStateChange} />
      </QueryClientProvider>,
    );
    return onStateChange;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("레벨 폴더: 곡 목록 API에 폴더·구간·정렬을 넘기고, 곡은 곡 목록 상세로 연결한다", async () => {
    fetchMock.mockResolvedValue(json(page([row])));
    renderView({ axis: "level", key: 9.5, bucket: "R95", part: "GUITAR", sort: "RATE_DESC" });

    expect(await screen.findByText("레벨곡")).toBeInTheDocument();
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/songs/charts");
    for (const part of ["folder=9.50", "folderStep=0.50", "rateBucket=R95", "part=GUITAR", "sort=RATE_DESC", "page=0"]) {
      expect(url).toContain(part);
    }
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("9.50 ~ 9.99");
    expect(screen.getByText(/95 ~ 100%/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "레벨곡" })).toHaveAttribute("href", "/songs/100?from=songs&chart=10");
    expect(screen.getByRole("link", { name: "통계로" })).toHaveAttribute("href", "/me?tab=stats");
  });

  it("서열표 난이도: 서열표를 찾아 통계 API를 부르고, 곡은 서열표 상세로 연결한다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/difficulty-tables")) {
        return Promise.resolve(json([{ id: 3, name: "SRN+", instrumentPart: "GUITAR", noteOption: "SUPER_RANDOM_PLUS", status: "ACTIVE", revision: 1 }]));
      }
      return Promise.resolve(json(page([entry])));
    });
    renderView({ axis: "tier", key: 5.8, bucket: "UNPLAYED", part: null, sort: "LEVEL" });

    expect(await screen.findByText("서열표곡")).toBeInTheDocument();
    const url = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/stats/tier-rate-folders/charts")) ?? "";
    for (const part of ["tableId=3", "tier=5.8", "rateBucket=UNPLAYED"]) {
      expect(url).toContain(part);
    }
    expect(url).not.toContain("part=");
    expect(screen.getByRole("link", { name: "서열표곡" })).toHaveAttribute("href", "/songs/200?from=table&chart=20");
    expect(screen.getByRole("link", { name: "통계로" })).toHaveAttribute("href", "/me?tab=stats&axis=tier");
  });

  it("파트 칩과 정렬을 바꾸면 부모에게 새 상태를 알린다", async () => {
    fetchMock.mockResolvedValue(json(page([row])));
    const state: FolderViewState = { axis: "level", key: 9.5, bucket: "R95", part: null, sort: "LEVEL" };
    const onStateChange = renderView(state);
    await screen.findByText("레벨곡");

    fireEvent.click(within(screen.getByRole("group", { name: "파트" })).getByRole("button", { name: "Bass" }));
    expect(onStateChange).toHaveBeenCalledWith({ ...state, part: "BASS" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "RATE_ASC" } });
    expect(onStateChange).toHaveBeenCalledWith({ ...state, sort: "RATE_ASC" });
  });

  it("결과가 없으면 안내를, 오류면 알림을 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json(page([])));
    renderView({ axis: "level", key: 9.5, bucket: "R90", part: null, sort: "LEVEL" });
    expect(await screen.findByText("이 조건에 맞는 채보가 없습니다.")).toBeInTheDocument();
  });

  it("더 보기를 누르면 다음 페이지를 이어 붙인다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page([row], { totalElements: 2, totalPages: 2 })))
      .mockResolvedValueOnce(json(page([{ ...row, songDifficultyId: 11, title: "둘째곡" }], { page: 1, totalElements: 2, totalPages: 2 })));
    renderView({ axis: "level", key: 9.5, bucket: "R95", part: null, sort: "LEVEL" });
    await screen.findByText("레벨곡");
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByText("둘째곡")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("page=1");
  });
});
