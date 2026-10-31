import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { DifficultyTableView } from "@/components/table/DifficultyTableView";
import { ROW_GRID } from "@/components/table/EntryRow";
import { StageBadge } from "@/components/table/StageBadge";
import { DEFAULT_VIEW_STATE } from "@/lib/table-view-state";
import { TierGroupSection, groupStage } from "@/components/table/TierGroupSection";
import type { DifficultyTableResponse, PageResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

function entry(over: Partial<TableEntryResponse> = {}): TableEntryResponse {
  return {
    entryId: 1,
    songDifficultyId: 10,
    songId: 100,
    title: "테스트곡",
    addedVersion: "V1",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend: "상",
    recommendUncertain: false,
    pattern: "단일",
    patternUncertain: false,
    ratingEnabled: true,
    mine: { rate: 96.5, fullCombo: false, stage: "SS" },
    ...over,
  };
}

function group(over: Partial<TierGroupResponse> = {}): TierGroupResponse {
  return {
    tier: 5.8,
    total: 4,
    recorded: 3,
    exc: 1,
    fc: 0,
    ss: 1,
    s: 0,
    belowS: 1,
    averageRecorded: 90,
    averageWithZero: 67.5,
    entries: [entry()],
    ...over,
  };
}

describe("StageBadge", () => {
  it("단계 글자를 항상 표시한다 (색만으로 구분하지 않는다)", () => {
    render(<StageBadge stage="EXC" />);
    expect(screen.getByLabelText("달성 단계 EXC")).toHaveTextContent("EXC");
  });
});

describe("groupStage (묶음 전체 달성 단계)", () => {
  const all = (over: Partial<TierGroupResponse>) => group({ total: 4, recorded: 4, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, ...over });

  it("모든 곡이 EXC면 EXC", () => {
    expect(groupStage(all({ exc: 4 }))).toBe("EXC");
  });
  it("모든 곡이 같은 단계 '이상'이면 가장 낮은 그 단계 (EXC 1 + FC 1 + SS 2 → SS)", () => {
    expect(groupStage(all({ exc: 1, fc: 1, ss: 2 }))).toBe("SS");
    expect(groupStage(all({ exc: 1, fc: 3 }))).toBe("FC");
    expect(groupStage(all({ ss: 1, s: 3 }))).toBe("S");
  });
  it("한 곡이라도 S 미만이거나 기록이 없으면 없음", () => {
    expect(groupStage(all({ exc: 3, belowS: 1 }))).toBeNull();
    expect(groupStage(all({ exc: 3, recorded: 3 }))).toBeNull(); // 미플레이 1곡
  });
  it("곡이 0개인 묶음은 없음", () => {
    expect(groupStage(all({ total: 0, recorded: 0 }))).toBeNull();
  });
});

describe("TierGroupSection", () => {
  it("묶음 전체가 한 단계 이상이면 머리에 단계 효과(막대)가 붙고, 아니면 붙지 않는다", () => {
    const { container, rerender } = render(
      <TierGroupSection group={group({ total: 4, recorded: 4, exc: 1, fc: 0, ss: 3, s: 0, belowS: 0 })} includeZero={false} />,
    );
    expect(container.querySelector("header[data-group-stage='SS']")).not.toBeNull();
    expect(container.querySelector("header .stage-bar")).not.toBeNull();
    rerender(<TierGroupSection group={group()} includeZero={false} />);
    expect(container.querySelector("header[data-group-stage]")).toBeNull();
    expect(container.querySelector("header .stage-bar")).toBeNull();
  });

  it("제목, 0이 아닌 단계 칩(순서 그대로), 기록 n/전체, 미포함 평균을 보여 준다", () => {
    render(<TierGroupSection group={group()} includeZero={false} />);
    expect(screen.getByRole("heading", { name: /5\.8\s*4개/ })).toBeInTheDocument();
    const chips = within(screen.getByRole("list", { name: "내 달성 현황" })).getAllByRole("listitem");
    // 0인 칩(FC 0, S 0)은 숨긴다(2026-10-27)
    expect(chips.map((c) => c.textContent)).toEqual(["EXC 1", "SS 1", "S 미만 1"]);
    expect(screen.getByText("기록 3/4")).toBeInTheDocument();
    expect(screen.getByText("90.00%")).toBeInTheDocument();
  });

  it("'0% 포함'이면 서버가 준 0% 포함 평균을 보여 준다", () => {
    render(<TierGroupSection group={group()} includeZero />);
    expect(screen.getByText("67.50%")).toBeInTheDocument();
  });

  it("기록이 하나도 없는 묶음은 미포함 평균을 `–`로 보여 준다", () => {
    render(
      <TierGroupSection
        group={group({ recorded: 0, exc: 0, ss: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries: [entry({ mine: null })] })}
        includeZero={false}
      />,
    );
    expect(screen.getByText("기록 0/4")).toBeInTheDocument();
    // 기록이 없으면 단계 칩이 하나도 없다(0 칩 숨김)
    expect(within(screen.getByRole("list", { name: "내 달성 현황" })).queryAllByRole("listitem")).toHaveLength(0);
    // `–`는 줄마다 달성률 자리에도 나오므로 평균 문구 안에서만 확인한다
    expect(screen.getByText(/^평균/)).toHaveTextContent("평균 –");
  });

  it("레이팅 상수 난이도가 없는 묶음은 `미정`이라고 쓴다", () => {
    render(<TierGroupSection group={group({ tier: null })} includeZero={false} />);
    expect(screen.getByRole("heading", { name: /미정/ })).toBeInTheDocument();
  });

  it("기록이 있는 줄은 단계 표시와 달성률을, 없는 줄은 단계 없이 `–`를 보여 준다", () => {
    render(
      <TierGroupSection
        group={group({
          entries: [
            entry({ entryId: 1, title: "기록있음", mine: { rate: 100, fullCombo: true, stage: "EXC" } }),
            entry({ entryId: 2, title: "기록없음", mine: null }),
          ],
        })}
        includeZero={false}
      />,
    );
    // 모바일 카드와 데스크톱 줄이 둘 다 DOM에 있어 곡명이 두 번씩 나온다 (보이는 쪽은 CSS가 정한다)
    expect(screen.getAllByText("기록있음")).toHaveLength(2);
    expect(screen.getAllByLabelText("달성 단계 EXC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MAX").length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText(/달성 단계/)).toHaveLength(2); // 기록 있는 곡의 카드 + 줄 하나씩, 기록 없는 곡은 없음
  });

  it("기록이 있는 줄은 레이팅에 찍히는 점수를 티어 색으로 보인다 (5.8, 96.5% -> 272.00)", () => {
    render(<TierGroupSection group={group({ entries: [entry({ entryId: 1 }), entry({ entryId: 2, title: "기록없음", mine: null })] })} includeZero={false} />);
    // 기록 있는 곡만 카드 + 줄 하나씩. 점수 = (13×0.8 + 3.2) × 20, 272는 Alien 구간(250 이상 275 미만)이다
    const scores = screen.getAllByLabelText("레이팅 점수 272.00");
    expect(scores).toHaveLength(2);
    expect(scores[0]).toHaveTextContent("272.00");
    expect(scores[0]).toHaveAttribute("data-tier", "ALIEN");
    expect(scores[0]).toHaveClass("chart-cell");
    expect(screen.queryAllByLabelText(/레이팅 점수/)).toHaveLength(2);
  });

  it("점수 칩을 누르면 그 채보의 기록 창을 열도록 알린다 (기록이 있는 줄만)", () => {
    const onRecord = vi.fn();
    render(
      <TierGroupSection
        group={group({ entries: [entry({ entryId: 1, title: "기록있음" }), entry({ entryId: 2, title: "기록없음", mine: null })] })}
        includeZero={false}
        onRecord={onRecord}
      />,
    );
    // 기록이 없는 곡에는 점수가 없으니 칩 버튼도 없다. 있는 곡은 카드 + 줄 하나씩
    expect(screen.queryAllByRole("button", { name: "기록없음 기록 수정" })).toHaveLength(0);
    const chips = screen.getAllByRole("button", { name: "기록있음 기록 수정" });
    expect(chips).toHaveLength(2);
    fireEvent.click(chips[0]);
    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ title: "기록있음" }), 5.8);
  });

  it("레이팅 대상이 아니거나(속성 `레이팅 제외`) 난이도가 미정이면 점수 대신 `–`를 보인다", () => {
    const { rerender } = render(
      <TierGroupSection group={group({ entries: [entry({ pattern: "레이팅 제외" })] })} includeZero={false} />,
    );
    expect(screen.queryAllByLabelText(/레이팅 점수 \d/)).toHaveLength(0);
    expect(screen.getAllByLabelText("레이팅 점수 없음").length).toBeGreaterThan(0);
    rerender(<TierGroupSection group={group({ tier: null, entries: [entry()] })} includeZero={false} />);
    expect(screen.queryAllByLabelText(/레이팅 점수 \d/)).toHaveLength(0);
  });
});

describe("TierGroupSection 접기", () => {
  const entries = [entry({ entryId: 1, title: "Banana" })];

  it("collapsible이면 처음에는 닫혀 있고 머리의 칩·평균만 보인다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} collapsible />);
    const toggle = screen.getByRole("button", { name: /5\.8/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "내 달성 현황" })).toBeInTheDocument(); // 머리 정보는 닫혀도 보인다
  });

  it("제목 줄을 누르면 채보 목록이 펼쳐지고 다시 누르면 접힌다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} collapsible />);
    const toggle = screen.getByRole("button", { name: /5\.8/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Banana").length).toBeGreaterThan(0);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("접기 버튼이 머리 전체로 늘어나 칩·평균 자리를 눌러도 반응한다(::after 덮개)", () => {
    const { container } = render(<TierGroupSection group={group({ entries })} includeZero={false} collapsible />);
    const toggle = screen.getByRole("button", { name: /5\.8/ });
    // jsdom은 CSS 위치를 계산하지 않아 클래스로 확인한다: 덮개가 가장 가까운 relative 조상(header) 전체를 덮는다
    expect(toggle).toHaveClass("after:absolute", "after:inset-0");
    expect(container.querySelector("header")).toHaveClass("relative");
  });

  it("모바일은 접힌 묶음에서 칩과 기록 수를 숨기고(md 이상은 보임), 펼치면 보인다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} collapsible />);
    const chips = screen.getByRole("list", { name: "내 달성 현황" });
    const recorded = screen.getByText(/기록 \d+\/\d+/);
    // jsdom은 CSS를 계산하지 않으므로 클래스로 확인한다: 접힘 = 모바일 숨김 + md 이상 표시
    expect(chips).toHaveClass("hidden", "md:flex");
    expect(recorded).toHaveClass("hidden", "md:flex");
    fireEvent.click(screen.getByRole("button", { name: /5\.8/ }));
    expect(chips).toHaveClass("flex");
    expect(chips).not.toHaveClass("hidden");
    expect(recorded).not.toHaveClass("hidden");
  });

  it("묶음 화면(collapsible 아님)은 항상 펼쳐 있어서 칩과 기록 수가 숨겨지지 않는다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} />);
    expect(screen.getByRole("list", { name: "내 달성 현황" })).not.toHaveClass("hidden");
    expect(screen.getByText(/기록 \d+\/\d+/)).not.toHaveClass("hidden");
  });

  it("collapsible이 아니면(묶음 화면) 버튼 없이 항상 펼쳐 있다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} />);
    expect(screen.queryByRole("button", { name: /5\.8/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Banana").length).toBeGreaterThan(0);
  });
});

describe("TierGroupSection 정렬", () => {
  const entries = [
    entry({ entryId: 1, title: "Banana", mine: { rate: 90, fullCombo: false, stage: "A" } }),
    entry({ entryId: 2, title: "Apple", mine: { rate: 99, fullCombo: false, stage: "SS" } }),
  ];
  // 모바일 카드와 데스크톱 줄이 둘 다 DOM에 있어, 곡명이 나오는 순서 중 앞의 둘(카드)만 본다.
  // (머리 줄의 묶음 칩도 li라서 li 순서로 세지 않고 곡명 글자로 찾는다)
  const cardTitles = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("*"))
      .filter((el) => el.children.length === 0 && /^(Banana|Apple)$/.test(el.textContent ?? ""))
      .slice(0, 2)
      .map((el) => el.textContent ?? "");

  it("정렬 기준을 주면 묶음 안 채보 순서가 바뀐다", () => {
    const { container, rerender } = render(<TierGroupSection group={group({ entries })} includeZero={false} />);
    expect(cardTitles(container)[0]).toContain("Banana"); // 기본은 서버 순서
    rerender(<TierGroupSection group={group({ entries })} includeZero={false} sort="title" />);
    expect(cardTitles(container)[0]).toContain("Apple");
    rerender(<TierGroupSection group={group({ entries })} includeZero={false} sort="rateDesc" />);
    expect(cardTitles(container)[0]).toContain("Apple");
    rerender(<TierGroupSection group={group({ entries })} includeZero={false} sort="rateAsc" />);
    expect(cardTitles(container)[0]).toContain("Banana");
  });
});

describe("DifficultyTableView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const table: DifficultyTableResponse = {
    id: 3,
    name: "SRN+ 서열표",
    instrumentPart: "GUITAR",
    noteOption: "SUPER_RANDOM_PLUS",
    status: "ACTIVE",
    revision: 1,
  };

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }
  function page(groups: TierGroupResponse[], over: Partial<PageResponse<TierGroupResponse>> = {}) {
    return { content: groups, page: 0, size: 10, totalElements: groups.length, totalPages: 1, ...over };
  }
  function renderView() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <DifficultyTableView userId={1} />
      </QueryClientProvider>,
    );
  }
  /**
   * 호출된 URL 중 서열표 본문의 entries 요청의 쿼리 값을 읽는다.
   * 난이도 바로가기용 전체 묶음 요청(size 지정)은 따로 가므로 센다고 순서가 밀리지 않게 뺀다.
   */
  function entryParams(index: number): URLSearchParams {
    const urls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/entries") && !new URL(u, "http://x").searchParams.has("size"));
    return new URL(urls[index], "http://x").searchParams;
  }
  /** 가장 마지막에 보낸 서열표 요청의 쿼리 (난이도 바로가기용 전체 요청은 제외) */
  function lastEntryParams(): URLSearchParams {
    const urls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/entries") && !new URL(u, "http://x").searchParams.has("size"));
    return new URL(urls[urls.length - 1], "http://x").searchParams;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("SRN+ 서열표를 골라 묶음을 보여 준다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    expect(await screen.findByRole("heading", { name: "SRN+ 서열표" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /5\.8/ })).toBeInTheDocument();
    expect(String(fetchMock.mock.calls.find((c) => String(c[0]).includes("/entries"))?.[0])).toContain(
      "/difficulty-tables/3/entries",
    );
  });

  it("난이도 이동 목록에는 미정 묶음이 나오지 않는다 (미정은 곡 목록에만)", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("/entries") ? json(page([group({ tier: 5.8 }), group({ tier: null })])) : json([table]),
      ),
    );
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "난이도 이동" }));
    const nav = await screen.findByRole("navigation", { name: "난이도 바로가기" });
    expect(within(nav).getByRole("link", { name: /5\.8/ })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /미정/ })).not.toBeInTheDocument();
  });

  it("`모두 펼치기`는 지금 페이지의 모든 묶음을 열고 `모두 접기`로 닫는다 (직접 연 묶음이 있으면 `모두 펼치기`)", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group({ tier: 5.8 }), group({ tier: 5.6 })])) : json([table])),
    );
    renderView();
    const first = await screen.findByRole("button", { name: /5\.8/ });
    const second = screen.getByRole("button", { name: /5\.6/ });
    expect(first).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(first); // 하나만 직접 연다 -> 아직 전부는 아니라서 `모두 펼치기`
    fireEvent.click(screen.getByRole("button", { name: "모두 펼치기" }));
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "모두 접기" }));
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "모두 펼치기" })).toBeInTheDocument();
  });

  it("펼친 묶음은 곡 상세에 갔다 와서 화면을 다시 만들어도 그대로 펼쳐 있다 (이 탭에 기억)", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group({ tier: 5.8 }), group({ tier: 5.6 })])) : json([table])),
    );
    const first = renderView();
    fireEvent.click(await screen.findByRole("button", { name: /5\.8/ }));
    expect(screen.getByRole("button", { name: /5\.8/ })).toHaveAttribute("aria-expanded", "true");
    first.unmount(); // 곡 상세로 이동하면 서열표 화면이 사라진다

    renderView(); // 뒤로 가기: 새로 만들어진다
    expect(await screen.findByRole("button", { name: /5\.8/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /5\.6/ })).toHaveAttribute("aria-expanded", "false"); // 열지 않은 묶음은 닫혀 있다
  });

  it("보기 상태(state)를 받으면 그 값으로 조회하고, 페이지·필터를 바꾸면 onStateChange로 알린다 (주소에 저장하려고)", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()], { page: 1, totalPages: 3 })) : json([table])),
    );
    const onStateChange = vi.fn();
    const state = { ...DEFAULT_VIEW_STATE, page: 1, sort: "rateDesc" as const, filters: { part: "BASS" as const, recommend: ["상"], pattern: [] } };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DifficultyTableView userId={1} state={state} onStateChange={onStateChange} />
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { name: /5\.8/ });
    const params = lastEntryParams();
    expect(params.get("page")).toBe("1");
    expect(params.get("part")).toBe("BASS");
    expect(params.get("recommend")).toBe("상");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(onStateChange).toHaveBeenLastCalledWith({ ...state, page: 2 });
    fireEvent.click(screen.getByRole("button", { name: "0% 포함" }));
    expect(onStateChange).toHaveBeenLastCalledWith({ ...state, includeZero: true });
  });

  it("서열표 화면 상단에 정보 제공자 표기와 X 링크를 보여 준다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    expect(await screen.findByRole("link", { name: /イズニャン/ })).toHaveAttribute("href", "https://x.com/trist_is");
  });

  it("SRN+ 서열표가 없으면 안내 문구를 보여 준다", async () => {
    fetchMock.mockResolvedValue(json([{ ...table, noteOption: "NORMAL" }]));
    renderView();
    expect(await screen.findByText("SRN+ 서열표가 아직 없습니다.")).toBeInTheDocument();
  });

  it("서버 오류는 서버가 준 문구로 알려 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL", message: "서버에 문제가 생겼습니다.", timestamp: "t" }, 500));
    renderView();
    expect(await screen.findByRole("alert")).toHaveTextContent("서버에 문제가 생겼습니다.");
  });

  it("필터를 바꾸면 해당 값으로 다시 요청하고 첫 페이지로 돌아간다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("/entries") ? json(page([group()], { page: 0, totalPages: 3 })) : json([table]),
      ),
    );
    renderView();
    await screen.findByRole("heading", { name: /5\.8/ });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => expect(entryParams(1).get("page")).toBe("1"));

    fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "단일 외" }));
    await waitFor(() => expect(entryParams(2).get("pattern")).toBe("복합,이중,삼중"));
    expect(entryParams(2).get("page")).toBe("0");
    expect(screen.queryByRole("group", { name: "파트" })).toBeNull(); // 서열표에는 파트 필터가 없다(2026-10-31)
  });

  it("처음에는 추천 상·중만 걸려 있고, 그 값으로 조회한다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    await screen.findByRole("heading", { name: /5\.8/ });
    const recommend = within(screen.getByRole("group", { name: "추천" }));
    expect(entryParams(0).get("recommend")).toBe("상,중");
    expect(recommend.getByRole("button", { name: "상" })).toHaveAttribute("aria-pressed", "true");
    expect(recommend.getByRole("button", { name: "중" })).toHaveAttribute("aria-pressed", "true");
    expect(recommend.getByRole("button", { name: "하" })).toHaveAttribute("aria-pressed", "false");
    expect(recommend.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "false");
  });

  it("추천·속성은 여러 개를 골라 한 번에 조회하고, 전체를 누르면 해제한다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    await screen.findByRole("heading", { name: /5\.8/ });
    const recommend = within(screen.getByRole("group", { name: "추천" }));

    fireEvent.click(recommend.getByRole("button", { name: "하" })); // 상,중 + 하
    await waitFor(() => expect(lastEntryParams().get("recommend")).toBe("상,중,하"));
    fireEvent.click(recommend.getByRole("button", { name: "상" })); // 상을 끄면 중,하
    await waitFor(() => expect(lastEntryParams().get("recommend")).toBe("중,하"));
    expect(recommend.getByRole("button", { name: "상" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "단일" }));
    await waitFor(() => {
      const params = lastEntryParams();
      expect(params.get("recommend")).toBe("중,하");
      expect(params.get("pattern")).toBe("단일");
    });

    fireEvent.click(recommend.getByRole("button", { name: "전체" }));
    await waitFor(() => expect(lastEntryParams().has("recommend")).toBe(false));
    expect(recommend.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
  });

  it("데스크톱: 필터가 한 카드에 가로로 놓이고(md:flex-row) 모바일은 세로 접이식 패널 그대로다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    await screen.findByRole("button", { name: /^필터/ });
    const panel = document.getElementById("table-filters");
    expect(panel).not.toBeNull();
    // 모바일 기본: 접혀 있고(hidden) 펼치면 세로(flex-col)
    expect(panel).toHaveClass("hidden", "flex-col");
    // 데스크톱: 항상 보이고 가로로 놓이며 넘치면 줄바꿈
    expect(panel).toHaveClass("md:flex", "md:flex-row", "md:flex-wrap");
    // 파트·추천·속성·정렬·평균 계산이 모두 이 카드 안에 있다
    for (const name of ["추천", "속성", "평균 계산"]) {
      expect(panel).toContainElement(screen.getByRole("group", { name }));
    }
  });

  it("표형 열 너비: 랭크 70 · 채보 190 · 달성률 90px (머리 행과 행이 같은 값을 쓴다)", () => {
    expect(ROW_GRID).toContain("_70px_190px_90px_");
  });

  it("여러 개를 고르면 접힌 줄 요약에 모두 보인다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    const toggle = await screen.findByRole("button", { name: /^필터/ });
    expect(toggle).toHaveTextContent("추천 상·중 · 평균 0% 미포함"); // 기본값
    fireEvent.click(toggle);
    fireEvent.click(within(screen.getByRole("group", { name: "추천" })).getByRole("button", { name: "중" })); // 중 끄기
    fireEvent.click(within(screen.getByRole("group", { name: "추천" })).getByRole("button", { name: "하" })); // 하 켜기
    fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "단일" }));
    expect(toggle).toHaveTextContent("추천 상·하 · 속성 단일 · 평균 0% 미포함");
  });

  it("필터는 접었다 펼 수 있고, 접힌 줄에 걸린 필터를 요약한다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    const toggle = await screen.findByRole("button", { name: /^필터/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("추천 상·중 · 평균 0% 미포함");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "단일 외" }));
    fireEvent.click(within(screen.getByRole("group", { name: "추천" })).getByRole("button", { name: "상" })); // 상 끄기
    fireEvent.click(screen.getByRole("button", { name: "0% 포함" }));
    expect(toggle).toHaveTextContent("추천 중 · 속성 단일 외 · 평균 0% 포함");

    // `단일 외` 세부: 삼중을 끄면 요약이 복합·이중으로 바뀌고, 마지막 하나는 끌 수 없다
    const detail = within(screen.getByRole("group", { name: "단일 외 세부" }));
    fireEvent.click(detail.getByRole("button", { name: "삼중" }));
    fireEvent.click(detail.getByRole("button", { name: /이중/ }));
    expect(detail.getByRole("button", { name: /복합/ })).toBeDisabled();
    expect(toggle).toHaveTextContent("속성 복합");

    fireEvent.click(within(screen.getByRole("group", { name: "추천" })).getByRole("button", { name: "전체" }));
    fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "전체" }));
    expect(toggle).toHaveTextContent("전체 · 평균 0% 포함"); // 다 풀면 요약에서 빠진다
  });

  it("평균 토글은 서버를 다시 부르지 않고 표시만 바꾼다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    await screen.findByText("90.00%");
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "0% 포함" }));
    expect(screen.getByText("67.50%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "0% 포함" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it("줄의 기록 버튼을 누르면 그 채보의 기록 등록 창이 열린다", async () => {
    // 기록 창 안의 "내 기록 목록"이 로그인 정보(useAuth)를 쓰므로 AuthProvider로 감싼다
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return Promise.resolve(
          json({
            accessToken: "t",
            tokenType: "Bearer",
            expiresIn: 900,
            user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
          }),
        );
      }
      if (url.includes("/records?")) return Promise.resolve(json(page([]) as unknown));
      if (url.includes("/setlist")) return Promise.resolve(json(page([]) as unknown)); // 줄마다 있는 세트리스트 버튼이 받는 목록
      return Promise.resolve(url.includes("/entries") ? json(page([group()])) : json([table]));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <DifficultyTableView userId={1} />
        </AuthProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /5\.8/ })); // 묶음은 처음에 닫혀 있다
    expect(screen.queryByRole("heading", { name: "기록 등록" })).toBeNull();

    // 모바일 카드와 데스크톱 줄에 버튼이 하나씩 있다. 어느 쪽이 보일지는 화면 폭(CSS)이 정한다.
    fireEvent.click(screen.getAllByRole("button", { name: "테스트곡 기록 입력" })[0]);
    expect(await screen.findByRole("heading", { name: "기록 등록" })).toBeInTheDocument();
    expect(await screen.findByLabelText("달성률")).toBeInTheDocument(); // 내 기록을 불러온 뒤에 폼이 나온다
  });

  it("정렬을 바꿔도 서버에 다시 요청하지 않는다(화면에서 정렬)", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("/entries")
          ? json(page([group({ entries: [entry({ entryId: 1, title: "Banana" }), entry({ entryId: 2, title: "Apple" })] })]))
          : json([table]),
      ),
    );
    renderView();
    await screen.findByRole("heading", { name: /5\.8/ });
    const before = fetchMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText("정렬"), { target: { value: "title" } });

    expect(screen.getByLabelText("정렬")).toHaveValue("title");
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(within(screen.getByRole("combobox", { name: "정렬" })).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "레벨 높은 순",
      "내 달성률 높은 순",
      "내 달성률 낮은 순",
      "곡명 순",
      "추천도 순",
    ]);
  });
});
