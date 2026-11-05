import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TierFolderView } from "@/components/table/TierFolderView";
import { rememberTableReturn, viewStateToQuery, DEFAULT_VIEW_STATE } from "@/lib/table-view-state";
import type { DifficultyTableResponse, PageResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

// 이웃 이동은 router.replace로 한다(뒤로 가기 한 번이 서열표). 호출만 확인한다
const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }) }));

const table: DifficultyTableResponse = {
  id: 3,
  name: "SRN+ 서열표",
  instrumentPart: "GUITAR",
  noteOption: "SUPER_RANDOM_PLUS",
  status: "ACTIVE",
  revision: 1,
};

function entry(id: number, title: string): TableEntryResponse {
  return {
    entryId: id,
    songDifficultyId: id,
    songId: id,
    title,
    addedVersion: "V5",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend: "상",
    recommendUncertain: false,
    pattern: "단일",
    patternUncertain: false,
    ratingEnabled: true,
    mine: null,
  };
}

function group(tier: number | null, titles: string[]): TierGroupResponse {
  return {
    tier,
    total: titles.length,
    recorded: 0,
    exc: 0,
    fc: 0,
    ss: 0,
    s: 0,
    belowS: 0,
    averageRecorded: null,
    averageWithZero: 0,
    entries: titles.map((t, i) => entry(tier === null ? 900 + i : Math.round(tier * 100) + i, t)),
  };
}

describe("TierFolderView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const mixed = group(5.8, ["가곡", "나곡"]);
  mixed.entries[0] = { ...mixed.entries[0], part: "BASS", recommend: "하", pattern: "복합" };
  const groups = [group(5.9, ["라곡"]), mixed, group(5.0, ["다곡"]), group(null, ["미정곡"])];
  let playLevel: unknown = { status: "NEW_PLAYER", tier: null };

  function json(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  function renderView(param: string) {
    replaceMock.mockReset();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <TierFolderView userId={1} param={param} />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    fetchMock.mockReset();
    playLevel = { status: "NEW_PLAYER", tier: null };
    fetchMock.mockImplementation((input) => {
      const page: PageResponse<TierGroupResponse> = { content: groups, page: 0, size: 20, totalElements: 4, totalPages: 1 };
      const url = String(input);
      // 레이팅 반영 기준 줄(FolderThresholdNote)이 내 레이팅 목록을 읽는다. 비어 있으면 그 줄은 그리지 않는다
      if (url.includes("/skills/me/play-level")) return Promise.resolve(json(playLevel));
      if (url.includes("/skills/me")) return Promise.resolve(json({ single: [], other: [], singleLimit: 15, otherLimit: 25 }));
      return Promise.resolve(url.includes("/entries") ? json(page) : json([table]));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("주소의 레이팅 상수 난이도에 해당하는 묶음 하나만 보여 준다", async () => {
    renderView("5.8");
    expect(await screen.findByRole("heading", { name: /5\.8\s*2개/ })).toBeInTheDocument();
    expect(screen.getAllByText("가곡").length).toBeGreaterThan(0);
    expect(screen.queryByText("다곡")).not.toBeInTheDocument(); // 다른 묶음은 나오지 않는다
    expect(screen.getByRole("link", { name: "서열표로" })).toHaveAttribute("href", "/table");
  });

  it("묶음 화면에 난이도 칩 띠와 아래 이웃 난이도 막대가 있다", async () => {
    renderView("5.8");
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });
    expect(screen.getByRole("navigation", { name: "인접 난이도" })).toBeInTheDocument(); // 아래 고정 이웃 버튼
    expect(screen.getByRole("navigation", { name: "난이도 목록" })).toBeInTheDocument();
  });

  it("모바일에서는 필터를 `필터` 한 줄(지금 조건 요약)로 접어 두고, 누르면 펼친다 (서열표 본문과 같은 모양)", async () => {
    renderView("5.8");
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });
    const toggle = screen.getByRole("button", { name: /필터.*전체.*0% 미포함/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById("folder-filters");
    expect(panel?.className).toContain("hidden");
    expect(panel?.className).toContain("md:flex");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("folder-filters")?.className).not.toMatch(/(^| )hidden( |$)/);
  });

  it("undecided(미정) 주소는 서열표 화면에서 뺐으므로 찾을 수 없다", async () => {
    renderView("undecided");
    expect(await screen.findByRole("alert")).toHaveTextContent("묶음을 찾을 수 없습니다.");
    expect(screen.queryByText("미정곡")).not.toBeInTheDocument();
  });

  it("없는 묶음 주소는 `묶음을 찾을 수 없습니다.`", async () => {
    renderView("7.7");
    expect(await screen.findByRole("alert")).toHaveTextContent("묶음을 찾을 수 없습니다.");
  });

  it("처음에는 필터 없이 묶음 전체를 보여 주고, 속성 `단일 외`로 거르면 머리 개수도 걸러진 채보 기준이다", async () => {
    renderView("5.8");
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });

    expect(screen.queryByRole("group", { name: "파트" })).toBeNull(); // 파트 필터 없음(2026-10-31)
    const pattern = screen.getByRole("group", { name: "속성" });
    expect(within(pattern).getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(pattern).getByRole("button", { name: "단일 외" }));

    expect(await screen.findByRole("heading", { name: /5\.8\s*1개/ })).toBeInTheDocument();
    expect(screen.getAllByText("가곡").length).toBeGreaterThan(0); // 복합인 곡
    expect(screen.queryByText("나곡")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "인접 난이도" })).toBeInTheDocument();
  });

  it("추천·속성 칩도 걸리고, 조건에 맞는 채보가 없으면 안내를 보여 준다", async () => {
    renderView("5.8");
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });

    fireEvent.click(within(screen.getByRole("group", { name: "추천" })).getByRole("button", { name: "하" }));
    expect(await screen.findByRole("heading", { name: /5\.8\s*1개/ })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "단일" }));
    expect(await screen.findByText("조건에 맞는 채보가 없습니다.")).toBeInTheDocument();

    // 전체를 누르면 풀린다
    fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "전체" }));
    fireEvent.click(within(screen.getByRole("group", { name: "추천" })).getByRole("button", { name: "전체" }));
    expect(await screen.findByRole("heading", { name: /5\.8\s*2개/ })).toBeInTheDocument();
  });
  describe("폴더 머리 · 이웃 난이도 이동 (PR 2)", () => {
    const area = () => screen.getByTestId("folder-swipe-area");
    const swipe = (el: Element, dx: number, dy = 0) => {
      fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 300 }] });
      fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
    };
    const bar = () => screen.getByRole("navigation", { name: "인접 난이도" });

    it("머리: `←`(서열표로) + 큰 난이도 숫자 + 기록 n/전체. 머리에는 ‹ › 버튼이 없다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      expect(screen.getByRole("link", { name: "서열표로" })).toHaveAttribute("href", "/table");
      expect(screen.getAllByText("기록 0/2").length).toBeGreaterThan(0); // 머리 + 묶음 카드 머리
      expect(screen.queryByText("내 평균 난이도")).not.toBeInTheDocument();
    });

    it("지금 난이도가 내 평균이면 `내 평균 난이도` 글자가 붙는다", async () => {
      playLevel = { status: "READY", tier: 5.8 };
      renderView("5.8");
      expect(await screen.findByText("내 평균 난이도")).toBeInTheDocument();
    });

    it("평균이 다른 난이도면 글자가 없다", async () => {
      playLevel = { status: "READY", tier: 5.9 };
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("play-level"))).toBe(true));
      expect(screen.queryByText("내 평균 난이도")).not.toBeInTheDocument();
    });

    it("아래 고정 막대: 왼쪽은 바로 아래 난이도, 오른쪽은 바로 위 난이도(기록 n/전체와 함께)", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      const prev = within(bar()).getByRole("link", { name: /이전 난이도 5\.0/ });
      const next = within(bar()).getByRole("link", { name: /다음 난이도 5\.9/ });
      expect(prev).toHaveAttribute("href", "/table/folder/5.0");
      expect(prev).toHaveTextContent("5.00/1");
      expect(next).toHaveAttribute("href", "/table/folder/5.9");
      expect(next).toHaveTextContent("5.90/1");
      expect(bar().querySelector("a")).toBe(prev); // 왼쪽이 낮은 난이도
    });

    it("가장 높은/낮은 난이도에서는 없는 쪽 버튼이 링크가 아니다", async () => {
      const { unmount } = renderView("5.9");
      await screen.findByRole("heading", { name: /5\.9\s*1개/ });
      expect(within(bar()).queryByRole("link", { name: /다음 난이도/ })).not.toBeInTheDocument();
      expect(within(bar()).getByRole("link", { name: /이전 난이도 5\.8/ })).toBeInTheDocument();
      unmount();
      renderView("5.0");
      await screen.findByRole("heading", { name: /5\.0\s*1개/ });
      expect(within(bar()).queryByRole("link", { name: /이전 난이도/ })).not.toBeInTheDocument();
      expect(within(bar()).getByRole("link", { name: /다음 난이도 5\.8/ })).toBeInTheDocument();
    });

    it("곡 목록 영역을 왼쪽으로 60px 이상 쓸면 더 높은 난이도로, 오른쪽이면 더 낮은 난이도로 replace 이동한다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      swipe(area(), -80);
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.9");
      swipe(area(), 80);
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.0");
      expect(replaceMock).toHaveBeenCalledTimes(2);
    });

    it("60px 미만이거나 세로 이동이 더 크면 이동하지 않는다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      swipe(area(), -59);
      swipe(area(), -80, 90);
      swipe(area(), 80, -80);
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("끝 난이도에서 더 쓸면 이동하지 않고 살짝 튕긴다", async () => {
      renderView("5.9");
      await screen.findByRole("heading", { name: /5\.9\s*1개/ });
      swipe(area(), -100);
      expect(replaceMock).not.toHaveBeenCalled();
      expect(area()).toHaveAttribute("data-bounce", "higher");
      await waitFor(() => expect(area()).not.toHaveAttribute("data-bounce"));
    });

    it("움직임 줄이기 설정이면 끝 난이도에서 튕기지 않는다", async () => {
      vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("prefers-reduced-motion"), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
      renderView("5.9");
      await screen.findByRole("heading", { name: /5\.9\s*1개/ });
      swipe(area(), -100);
      expect(replaceMock).not.toHaveBeenCalled();
      expect(area()).not.toHaveAttribute("data-bounce");
    });

    it("입력 칸이나 가로로 스크롤되는 영역 위에서 시작한 스와이프는 이동하지 않는다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      const input = document.createElement("input");
      area().appendChild(input);
      swipe(input, -100);
      const scroller = document.createElement("div");
      scroller.style.overflowX = "auto";
      Object.defineProperty(scroller, "scrollWidth", { value: 500 });
      Object.defineProperty(scroller, "clientWidth", { value: 200 });
      area().appendChild(scroller);
      swipe(scroller, -100);
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("난이도 칩 띠 위의 쓸기는 이웃 이동이 아니다 (칩 띠 스크롤 우선: 칩 띠는 스와이프 영역 밖)", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      swipe(screen.getByRole("navigation", { name: "난이도 목록" }), -100);
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("서열표에서 눌러 들어왔으면 그때의 필터로 시작해 머리·이웃 n/전체가 타일과 같다 (기본 상·중이면 추천 하는 빠진다)", async () => {
      rememberTableReturn({ query: viewStateToQuery(DEFAULT_VIEW_STATE), scrollY: 120, unfolded: false });
      renderView("5.8");
      expect(await screen.findByRole("heading", { name: /5\.8\s*1개/ })).toBeInTheDocument(); // 가곡(추천 하) 제외
      expect(screen.getAllByText("기록 0/1").length).toBeGreaterThan(0);
    });

    it("서열표에서 필터 없이(전체) 들어왔으면 묶음 전체, `←`는 서열표 보기 상태 쿼리를 붙여 돌아간다", async () => {
      const query = viewStateToQuery({ ...DEFAULT_VIEW_STATE, filters: { part: null, recommend: [], pattern: ["복합"] } });
      rememberTableReturn({ query, scrollY: 0, unfolded: false });
      renderView("5.8");
      expect(await screen.findByRole("heading", { name: /5\.8\s*1개/ })).toBeInTheDocument(); // 속성 복합만
      expect(screen.getByRole("link", { name: "서열표로" })).toHaveAttribute("href", `/table?${query}`);
    });

    it("폴더 안에서 바꾼 필터는 서열표로 가져가지 않는다 (기억한 서열표 쿼리가 그대로다)", async () => {
      rememberTableReturn({ query: "rec=all", scrollY: 0, unfolded: false });
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      fireEvent.click(within(screen.getByRole("group", { name: "속성" })).getByRole("button", { name: "단일 외" }));
      expect(await screen.findByRole("heading", { name: /5\.8\s*1개/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "서열표로" })).toHaveAttribute("href", "/table?rec=all");
    });
  });
});
