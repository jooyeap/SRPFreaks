import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongListView } from "@/components/songs/SongListView";
import type { ChartFolderListResponse, ChartFolderResponse, ChartRowResponse, PageResponse } from "@/lib/api-types";
import { resetPageSizeForTest } from "@/lib/page-size";
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
  const folderCalls = () => fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.includes("/songs/chart-folders"));
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
    sessionStorage.clear();
    resetPageSizeForTest(); // 이전 테스트에서 고른 개수가 남지 않게
    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/songs/chart-folders")) {
        return Promise.resolve(json(url.includes("q=nomatch") ? { ...folders, totalSongs: 0, totalCharts: 0, folders: [] } : folders));
      }
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
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ }));
    const rowTitle = await screen.findByText("첫번째곡");
    // 행의 addedVersion은 V5지만 행 안에 나오지 않는다 (버전 필터의 선택지 V5와는 별개다)
    expect(rowTitle.closest("li")).not.toHaveTextContent("V5");
  });

  it("펼친 폴더는 곡 상세에 갔다 와서 화면을 다시 만들어도 그대로 펼쳐 있다 (이 탭에 기억)", async () => {
    const first = renderView();
    fireEvent.click(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ }));
    expect(await screen.findByText("첫번째곡")).toBeInTheDocument();
    first.unmount(); // 곡 상세로 이동하면 곡 목록 화면이 사라진다

    renderView(); // 뒤로 가기: 새로 만들어진다
    expect(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /9\.00 ~ 9\.49/ })).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByText("첫번째곡")).toBeInTheDocument(); // 펼친 폴더의 채보도 바로 이어서 보인다
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

  it("맨 위에서 개수를 바꾸면 펼친 폴더가 그 개수로 다시 채보를 받는다 (기본은 20개씩)", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ }));
    await screen.findByRole("link", { name: "첫번째곡" });
    expect(chartCalls().at(-1)).toContain("size=20");

    fireEvent.change(screen.getByRole("combobox", { name: "한 번에 보이는 개수" }), { target: { value: "50" } });

    await waitFor(() => expect(chartCalls().at(-1)).toContain("size=50"));
    expect(chartCalls().at(-1)).toContain("page=0"); // 이어 붙이던 쪽은 버리고 첫 쪽부터
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

  it("검색하면 폴더는 그대로 두고 검색어를 폴더 목록과 폴더 안 채보 요청에 함께 보낸다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });

    fireEvent.change(screen.getByRole("searchbox", { name: "곡 검색" }), { target: { value: "검색" } });

    await waitFor(() => expect(folderCalls().at(-1)).toContain("q=%EA%B2%80%EC%83%89"));
    // 결과 목록으로 바뀌지 않고 폴더가 남아 있다
    expect(screen.queryByRole("region", { name: "검색 결과" })).not.toBeInTheDocument();
    const header = await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });
    fireEvent.click(header);
    await screen.findByText("첫번째곡");
    expect(chartCalls().at(-1)).toContain("q=%EA%B2%80%EC%83%89");
    expect(chartCalls().at(-1)).toContain("folder=9.50");
  });

  it("검색어가 있으면 검색창 아래에 바로가기 후보가 나오고, 누르면 곡 상세로 가는 링크다 (8개까지만 요청)", async () => {
    renderView({ ...EMPTY_SONG_FILTERS, q: "검색" });

    const list = await screen.findByRole("list", { name: "검색 결과" });
    const link = within(list).getByRole("link", { name: /검색곡/ });
    expect(link).toHaveAttribute("href", "/songs/109?from=songs&chart=9");
    expect(within(list).getByLabelText("달성 단계 SS")).toBeInTheDocument();
    const candidateCall = chartCalls().find((u) => !u.includes("folder="));
    const params = new URL(candidateCall ?? "", "http://x").searchParams;
    expect(params.get("q")).toBe("검색");
    expect(params.get("size")).toBe("8");
  });

  it("검색어가 없으면 후보를 요청하지도 보이지도 않는다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });
    expect(screen.queryByRole("list", { name: "검색 결과" })).toBeNull();
    expect(chartCalls()).toHaveLength(0);
  });

  it("맞는 채보가 없으면 후보 목록은 그리지 않는다 (없을 때 안내는 폴더 목록 쪽이 한다)", async () => {
    renderView({ ...EMPTY_SONG_FILTERS, q: "nomatch" });
    expect(await screen.findByText("조건에 맞는 채보가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "검색 결과" })).toBeNull();
  });

  it("좌측 하단 고정 검색 버튼을 누르면 위쪽 검색창으로 포커스가 옮겨 간다", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderView();
    const button = await screen.findByRole("button", { name: "곡 검색" });
    expect(button).toHaveClass("fixed", "left-4");
    const input = screen.getByRole("searchbox");
    expect(input).not.toHaveFocus();

    fireEvent.click(button);

    expect(input).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalled();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("파트와 난이도(여러 개) 필터는 폴더 목록 요청의 서버 조건으로 전달된다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });

    fireEvent.click(screen.getByRole("button", { name: "Bass" }));
    fireEvent.click(screen.getByRole("button", { name: "EXT" }));
    fireEvent.click(screen.getByRole("button", { name: "MAS" }));

    await waitFor(() => {
      const last = folderCalls().at(-1) ?? "";
      expect(last).toContain("part=BASS");
      expect(last).toContain("difficulty=EXTREME%2CMASTER");
    });
    expect(screen.getByRole("button", { name: "필터 3" })).toBeInTheDocument();
  });

  it("난이도 필터에는 BAS가 없고 ADV·EXT·MAS만 있다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });
    expect(screen.queryByRole("button", { name: "BAS" })).not.toBeInTheDocument();
    for (const name of ["ADV", "EXT", "MAS"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("버전을 고르면 그 버전으로 거르고, 초기화하면 조건 없는 폴더 목록으로 돌아온다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });

    // 선택 상자가 둘이 되었으니(버전 + 한 번에 보이는 개수) 개수 선택을 뺀 나머지를 버전으로 본다
    const versionSelect = screen.getAllByRole("combobox").find((el) => el.getAttribute("aria-label") !== "한 번에 보이는 개수");
    fireEvent.change(versionSelect as HTMLElement, { target: { value: "V4" } });
    await waitFor(() => expect(folderCalls().at(-1)).toContain("version=V4"));

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    await waitFor(() => expect(folderCalls().at(-1)).not.toContain("version="));
    expect(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ })).toBeInTheDocument();
  });

  it("조건에 맞는 채보가 없으면 안내 문구를 보여 준다", async () => {
    renderView({ ...EMPTY_SONG_FILTERS, q: "nomatch" });
    expect(await screen.findByText("조건에 맞는 채보가 없습니다.")).toBeInTheDocument();
  });

  it("폴더가 10개를 넘으면 10개씩 나눠 보여 준다", async () => {
    const many: ChartFolderListResponse = { ...folders, folders: Array.from({ length: 11 }, (_, i) => folder(20 - i * 0.5)) };
    fetchMock.mockImplementation(() => Promise.resolve(json(many)));
    renderView();
    await screen.findByRole("button", { name: /20\.00 ~ 20\.49/ });
    expect(screen.getAllByRole("button", { name: /~/ })).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getAllByRole("button", { name: /~/ })).toHaveLength(1);
  });

  it("폴더를 받지 못하면 오류를 알린다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 500 })));
    renderView();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("데스크톱: 검색창과 필터가 한 카드 안에 있고, 필터 패널은 칸으로 풀려(md:contents) 한 줄에 놓인다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });
    const search = screen.getByRole("searchbox", { name: "곡 검색" });
    const filters = document.getElementById("song-filters");
    expect(filters).not.toBeNull();
    // 검색창과 필터 패널의 가장 가까운 공통 조상이 카드(md:border md:bg-card)다
    const card = filters!.parentElement!;
    expect(card).toContainElement(search);
    expect(card).toHaveClass("md:flex-row", "md:border", "md:bg-card");
    expect(filters).toHaveClass("md:contents");
    // 모바일 전용 필터 버튼은 데스크톱에서 숨긴다
    expect(screen.getByRole("button", { name: "필터" })).toHaveClass("md:hidden");
  });

  it("데스크톱: 평균 계산 토글이 제목 줄 오른쪽 격자 칸(md:col-start-2 md:row-start-1)에 놓인다", async () => {
    renderView();
    await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ });
    const toggleCell = screen.getByRole("button", { name: "0% 미포함" }).closest(".md\\:col-start-2");
    expect(toggleCell).not.toBeNull();
    expect(toggleCell).toHaveClass("md:row-start-1");
    // 모바일 순서는 그대로: 토글은 DOM에서 폴더 목록(첫 폴더 머리)보다 앞에 있다
    const folderHead = screen.getByRole("button", { name: /9\.50 ~ 9\.99/ });
    expect(toggleCell!.compareDocumentPosition(folderHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("데스크톱: 채보 목록 위에 열 머리글(곡명·랭크·채보·달성률)이 있고 화면 읽기 프로그램에는 숨긴다", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /9\.50 ~ 9\.99/ }));
    const list = await screen.findByRole("list", { name: "9.50 ~ 9.99 채보" });
    const header = list.previousElementSibling as HTMLElement;
    expect(header).toHaveAttribute("aria-hidden", "true");
    expect(header).toHaveClass("hidden", "md:grid");
    expect(header.textContent).toBe("곡명랭크채보달성률");
    // 머리글과 행이 같은 열 너비를 쓴다
    expect(header.className).toContain("md:grid-cols-[minmax(0,1fr)_70px_190px_90px]");
    expect(list.querySelector("li")?.className).toContain("md:grid-cols-[minmax(0,1fr)_70px_190px_90px]");
  });
});
