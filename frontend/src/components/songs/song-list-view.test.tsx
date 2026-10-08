import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongListView } from "@/components/songs/SongListView";
import type { ChartFolderListResponse, ChartFolderResponse, ChartRowResponse, PageResponse } from "@/lib/api-types";
import { EMPTY_SONG_FILTERS, type SongListFilters } from "@/lib/song-list";

function folder(lo: number, over: Partial<ChartFolderResponse> = {}): ChartFolderResponse {
  return {
    lo,
    hi: lo + 0.49,
    total: 3,
    recorded: 2,
    exc: 0,
    fc: 1,
    ss: 0,
    s: 0,
    belowS: 1,
    averageRecorded: 90.5,
    averageWithZero: 60.33,
    ...over,
  };
}

function row(id: number, title: string, over: Partial<ChartRowResponse> = {}): ChartRowResponse {
  return {
    songDifficultyId: id,
    songId: id + 100,
    title,
    addedVersion: "V5",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.6,
    mine: null,
    ...over,
  };
}

function page(content: ChartRowResponse[], p = 0, totalPages = 1, totalElements = content.length): PageResponse<ChartRowResponse> {
  return { content, page: p, size: 20, totalElements, totalPages };
}

const folders: ChartFolderListResponse = {
  totalSongs: 5,
  totalCharts: 7,
  versions: ["V4", "V5"],
  folders: [folder(9.5), folder(9.0, { total: 4, recorded: 0, fc: 0, belowS: 0, averageRecorded: null, averageWithZero: 0 })],
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** 부모(주소 쿼리) 역할: 조건을 상태로 들고 있다가 SongListView에 넘긴다. */
function Harness({ initial = EMPTY_SONG_FILTERS }: { initial?: SongListFilters }) {
  const [filters, setFilters] = useState(initial);
  return <SongListView userId={1} filters={filters} onFiltersChange={setFilters} />;
}

describe("SongListView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const chartCalls = () => fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.includes("/songs/charts"));

  function renderView(initial?: SongListFilters) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <Harness initial={initial} />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/songs/chart-folders")) return Promise.resolve(json(folders));
      if (url.includes("folder=9.50")) {
        return Promise.resolve(
          url.includes("page=1") ? json(page([row(3, "세번째곡")], 1, 2, 21)) : json(page([row(1, "첫번째곡"), row(2, "두번째곡")], 0, 2, 21)),
        );
      }
      if (url.includes("q=nomatch")) return Promise.resolve(json(page([])));
      return Promise.resolve(json(page([row(9, "검색곡", { mine: { rate: 96.5, fullCombo: false, stage: "SS" } })], 0, 1, 1)));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("레벨 높은 폴더부터 곡·채보 수와 통계를 보여 주고, 접힌 폴더는 채보를 요청하지 않는다", async () => {
    renderView();
    const top = await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });
    expect(screen.getByText("5곡 · 7개")).toBeInTheDocument();
    expect(top).toHaveTextContent("3개");
    expect(top).toHaveTextContent("FC 1");
    expect(top).toHaveTextContent("S 미만 1");
    expect(top).toHaveTextContent("기록 2/3");
    expect(top).toHaveTextContent("90.50%");
    expect(top).toHaveAttribute("aria-expanded", "false");
    expect(chartCalls()).toHaveLength(0);
  });

  it("`0% 포함`으로 바꾸면 기록 없는 채보를 0으로 넣은 평균이 보인다", async () => {
    renderView();
    const top = await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });
    fireEvent.click(screen.getByRole("button", { name: "0% 포함" }));
    expect(top).toHaveTextContent("60.33%");
    // 기록이 없는 폴더의 `0% 미포함` 평균은 –
    fireEvent.click(screen.getByRole("button", { name: "0% 미포함" }));
    expect(screen.getByRole("button", { name: /9\.00 ~ 9\.49/ })).toHaveTextContent("–");
  });

  it("폴더를 펼치면 그 폴더의 채보를 받아 곡 상세 링크와 함께 보여 준다", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ }));

    expect(await screen.findByRole("link", { name: "첫번째곡" })).toHaveAttribute("href", "/songs/101?from=songs&chart=1");
    expect(chartCalls()[0]).toContain("folder=9.50");
    expect(screen.getByText("두번째곡")).toBeInTheDocument();
  });

  it("`더 보기`는 다음 페이지를 이어 붙인다", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ }));
    await screen.findByText("첫번째곡");

    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));

    expect(await screen.findByText("세번째곡")).toBeInTheDocument();
    expect(screen.getByText("첫번째곡")).toBeInTheDocument(); // 앞 페이지도 그대로
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument(); // 마지막 페이지
  });

  it("검색하면 폴더 대신 결과 목록이 나오고 내 기록 단계가 보인다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });

    fireEvent.change(screen.getByRole("searchbox", { name: "곡 검색" }), { target: { value: "검색" } });

    const results = await screen.findByRole("region", { name: "검색 결과" });
    expect(within(results).getByText("검색곡")).toBeInTheDocument();
    expect(within(results).getByText("96.50")).toBeInTheDocument();
    expect(within(results).getByLabelText("달성 단계 SS")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /9\.50 ~ 9\.99/ })).not.toBeInTheDocument();
    expect(chartCalls().some((u) => u.includes("q=%EA%B2%80%EC%83%89"))).toBe(true);
  });

  it("파트와 난이도(여러 개) 필터는 서버 조건으로 전달된다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });

    fireEvent.click(screen.getByRole("button", { name: "Bass" }));
    fireEvent.click(screen.getByRole("button", { name: "EXT" }));
    fireEvent.click(screen.getByRole("button", { name: "MAS" }));

    await waitFor(() => {
      const last = chartCalls().at(-1) ?? "";
      expect(last).toContain("part=BASS");
      expect(last).toContain("difficulty=EXTREME%2CMASTER");
    });
    expect(screen.getByRole("button", { name: "필터 3" })).toBeInTheDocument();
  });

  it("버전을 고르면 그 버전으로 거르고, 초기화하면 폴더 목록으로 돌아온다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "V4" } });
    await waitFor(() => expect(chartCalls().at(-1)).toContain("version=V4"));

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ })).toBeInTheDocument();
  });

  it("조건에 맞는 채보가 없으면 안내 문구를 보여 준다", async () => {
    renderView({ ...EMPTY_SONG_FILTERS, q: "nomatch" });
    expect(await screen.findByText("조건에 맞는 채보가 없습니다.")).toBeInTheDocument();
  });

  it("폴더를 받지 못하면 오류를 알린다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 500 })));
    renderView();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
