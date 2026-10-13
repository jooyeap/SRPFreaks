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
    subFolders: [],
    ...over,
  };
}

/** 0.05 단위 하위 폴더 (hi = lo + 0.04, 자신의 subFolders는 비어 있다) */
function sub(lo: number, over: Partial<ChartFolderResponse> = {}): ChartFolderResponse {
  return folder(lo, { hi: lo + 0.04, total: 1, recorded: 0, fc: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, ...over });
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
function Harness({ initial = EMPTY_SONG_FILTERS, canRegister = false }: { initial?: SongListFilters; canRegister?: boolean }) {
  const [filters, setFilters] = useState(initial);
  return <SongListView userId={1} filters={filters} onFiltersChange={setFilters} canRegister={canRegister} />;
}

describe("SongListView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const chartCalls = () => fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.includes("/songs/charts"));

  function renderView(initial?: SongListFilters, canRegister = false) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <Harness initial={initial} canRegister={canRegister} />
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

  it("채보 행에는 버전을 보이지 않는다(버전은 필터로만 쓴다)", async () => {
    renderView({ ...EMPTY_SONG_FILTERS, q: "검색" });
    const rowTitle = await screen.findByText("검색곡");
    // 행의 addedVersion은 V5지만 행 안에 나오지 않는다 (버전 필터의 선택지 V5와는 별개다)
    expect(rowTitle.closest("li")).not.toHaveTextContent("V5");
  });

  it("곡 등록 버튼은 canRegister(ROOT·ADMIN)일 때만 보인다", async () => {
    const { unmount } = renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });
    expect(screen.queryByRole("button", { name: "곡 등록" })).toBeNull();
    unmount();

    renderView(undefined, true);
    expect(await screen.findByRole("button", { name: "곡 등록" })).toBeInTheDocument();
  });

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

  it("폴더의 모든 채보가 같은 단계 이상이면 머리에 그 단계 효과가 붙고, 하나라도 모자라면 붙지 않는다", async () => {
    // 9.50: 3개 중 EXC 1 + SS 2 = 모두 SS 이상 -> SS / 9.00: 4개 중 기록 없는 것이 있어 효과 없음
    const all: ChartFolderListResponse = {
      ...folders,
      folders: [
        folder(9.5, { total: 3, recorded: 3, exc: 1, fc: 0, ss: 2, s: 0, belowS: 0 }),
        folder(9.0, { total: 4, recorded: 3, exc: 1, fc: 0, ss: 2, s: 0, belowS: 0 }),
      ],
    };
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/songs/chart-folders") ? json(all) : json(page([]))),
    );
    renderView();

    expect(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ })).toHaveAttribute("data-stage", "SS");
    expect(screen.getByRole("button", { name: /9\.00 ~ 9\.49/ })).not.toHaveAttribute("data-stage");
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
    expect(chartCalls()[0]).toContain("folderStep=0.50");
    expect(screen.getByText("두번째곡")).toBeInTheDocument();
  });

  it("하위 폴더가 있으면 큰 폴더를 펼칠 때 하위 폴더만 보이고, 하위 폴더를 펼쳐야 채보를 요청한다", async () => {
    const withSubs: ChartFolderListResponse = {
      ...folders,
      folders: [folder(9.5, { subFolders: [sub(9.55, { total: 2 }), sub(9.5)] })],
    };
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/songs/chart-folders")) return Promise.resolve(json(withSubs));
      return Promise.resolve(json(page([row(1, "하위곡")])));
    });
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ }));
    const upper = await screen.findByRole("button", { name: /9\.55 ~ 9\.59/ });
    const lower = screen.getByRole("button", { name: /9\.50 ~ 9\.54/ });
    expect(upper).toHaveTextContent("2개");
    // 레벨 높은 하위 폴더가 위
    expect(upper.compareDocumentPosition(lower) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chartCalls()).toHaveLength(0);

    fireEvent.click(upper);
    expect(await screen.findByRole("link", { name: "하위곡" })).toBeInTheDocument();
    // 같은 시작값이라도 단위를 같이 보내 서버가 하위 폴더 범위로 읽게 한다
    expect(chartCalls()).toHaveLength(1);
    expect(chartCalls()[0]).toContain("folder=9.55");
    expect(chartCalls()[0]).toContain("folderStep=0.05");
  });

  it("큰 폴더와 하위 폴더의 시작값이 같아도(9.50) 서로 다른 목록으로 캐시된다", async () => {
    const withSubs: ChartFolderListResponse = { ...folders, folders: [folder(9.5, { subFolders: [sub(9.5)] })] };
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/songs/chart-folders") ? json(withSubs) : json(page([row(1, "하위곡")]))),
    );
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ }));
    fireEvent.click(await screen.findByRole("button", { name: /9\.50 ~ 9\.54/ }));

    await screen.findByRole("link", { name: "하위곡" });
    // 큰 폴더는 하위 폴더를 보여 주므로 채보 요청은 하위 폴더 것 하나뿐이다
    expect(chartCalls()).toHaveLength(1);
    expect(chartCalls()[0]).toContain("folderStep=0.05");
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
