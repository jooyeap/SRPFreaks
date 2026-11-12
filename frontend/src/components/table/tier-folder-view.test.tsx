import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TierFolderView } from "@/components/table/TierFolderView";
import { readDetailNav, resetDetailNavForTest } from "@/lib/detail-nav";
import { requestFolderScrollAdjust, takeFolderScrollAdjust } from "@/lib/folder-scroll";
import { rememberTableReturn, viewStateToQuery, DEFAULT_VIEW_STATE } from "@/lib/table-view-state";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
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
  function renderView(param: string, userId = 1) {
    replaceMock.mockReset();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <TierFolderView userId={userId} param={param} />
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

  it("비로그인이면 내 기록 칸(알약·점수·기록 버튼)을 그리지 않고, 목록 위에 로그인 안내 한 줄과 로그인 버튼을 둔다 (2026-11-12)", async () => {
    renderView("5.8", ANONYMOUS_VIEWER_ID);
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });
    expect(screen.getAllByText("가곡").length).toBeGreaterThan(0); // 곡 목록은 그대로
    // 달성률 칸 없음: `[– | –]` 알약이 없고, 머리 행에 `랭크 · 달성률`·`점수` 칸이 없으며, 기록 입력 버튼도 없다
    expect(document.body.textContent).not.toContain("––");
    expect(document.body.textContent).not.toContain("랭크 · 달성률");
    expect(screen.queryByRole("button", { name: /기록 입력/ })).toBeNull();
    // 안내 한 줄 + 로그인 버튼(링크)
    expect(screen.getByText("로그인하면 내 달성률이 여기에 표시돼요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });

  it("로그인하면 안내 한 줄은 없고 내 기록 칸이 있다", async () => {
    renderView("5.8");
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });
    expect(screen.queryByText("로그인하면 내 달성률이 여기에 표시돼요")).toBeNull();
    expect(document.body.textContent).toContain("랭크 · 달성률");
    expect(screen.getAllByRole("button", { name: /기록 입력/ }).length).toBeGreaterThan(0);
  });

  it("undecided(미정) 주소는 서열표 화면에서 뺐으므로 찾을 수 없다", async () => {
    renderView("undecided");
    expect(await screen.findByRole("alert")).toHaveTextContent("묶음을 찾을 수 없습니다.");
    expect(screen.queryByText("미정곡")).not.toBeInTheDocument();
  });

  it("곡 링크를 누르면 이 목록의 정렬·필터와 채보를 곡 상세의 이전/다음 이동용으로 기억한다", async () => {
    resetDetailNavForTest();
    renderView("5.8");
    await screen.findByRole("heading", { name: /5\.8\s*2개/ });
    const link = screen.getAllByRole("link").find((a) => /\/songs\/\d+\?from=table&chart=\d+/.test(a.getAttribute("href") ?? ""));
    expect(link).toBeDefined();
    link?.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link as HTMLElement);
    expect(readDetailNav()).toMatchObject({ source: "table", sort: "level" });
    resetDetailNavForTest();
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

    it("아래 고정 알약: 왼쪽 구역은 바로 아래 난이도, 오른쪽 구역은 바로 위 난이도, 가운데는 지금 난이도와 기록 n/전체", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      const prev = within(bar()).getByRole("button", { name: "이전 난이도 5.0" });
      const next = within(bar()).getByRole("button", { name: "다음 난이도 5.9" });
      expect(prev).toHaveTextContent("5.0");
      expect(next).toHaveTextContent("5.9");
      expect(within(bar()).getByTestId("folder-pill-center")).toHaveTextContent("5.80/2");
      expect(bar().querySelector("button")).toBe(prev); // 왼쪽이 낮은 난이도
    });

    it("구역 전체가 눌린다: 구역 자체와 숫자 라벨을 눌러도 replace로 이동한다 (아이콘만이 아니다)", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      const prev = within(bar()).getByRole("button", { name: "이전 난이도 5.0" });
      fireEvent.click(prev);
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.0", { scroll: false }); // 맨 위로 올리지 않는다(D68)
      fireEvent.click(within(prev).getByText("5.0"));
      expect(replaceMock).toHaveBeenCalledTimes(2);
      const next = within(bar()).getByRole("button", { name: "다음 난이도 5.9" });
      fireEvent.click(within(next).getByText("5.9"));
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.9", { scroll: false });
    });

    it("가장 높은/낮은 난이도에서는 없는 쪽 구역이 숨겨지고(접근성 트리에서 빠짐) 자리는 남는다", async () => {
      const { unmount } = renderView("5.9");
      await screen.findByRole("heading", { name: /5\.9\s*1개/ });
      expect(within(bar()).queryByRole("button", { name: /다음 난이도/ })).not.toBeInTheDocument();
      expect(within(bar()).getByRole("button", { name: "이전 난이도 5.8" })).toBeInTheDocument();
      // 세 칸(왼쪽 구역 · 가운데 · 오른쪽 구역 자리)이 모두 있어서 가운데 라벨이 정중앙이다
      const pill = within(bar()).getByTestId("folder-pill");
      expect(pill.children).toHaveLength(3);
      expect(pill.className).toContain("grid-cols-[1fr_auto_1fr]");
      const empty = within(bar()).getByTestId("folder-pill-next-empty");
      expect(empty).toHaveAttribute("aria-hidden", "true");
      expect(empty).toHaveAttribute("inert");
      unmount();
      renderView("5.0");
      await screen.findByRole("heading", { name: /5\.0\s*1개/ });
      expect(within(bar()).queryByRole("button", { name: /이전 난이도/ })).not.toBeInTheDocument();
      expect(within(bar()).getByRole("button", { name: "다음 난이도 5.8" })).toBeInTheDocument();
      expect(within(bar()).getByTestId("folder-pill").children).toHaveLength(3);
      expect(within(bar()).getByTestId("folder-pill-prev-empty")).toHaveAttribute("aria-hidden", "true");
    });

    it("화살표 아이콘과 진행 막대는 장식(aria-hidden)이고 n/전체는 글자로 읽힌다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      expect(bar().querySelectorAll("svg").length).toBe(2);
      bar().querySelectorAll("svg").forEach((svg) => expect(svg).toHaveAttribute("aria-hidden", "true"));
      expect(within(bar()).getByTestId("folder-pill-bar")).toHaveAttribute("aria-hidden", "true");
      expect(within(bar()).getByTestId("folder-pill-fill")).toHaveStyle({ width: "0%" }); // 기록 0/2
      expect(within(bar()).getByText("0/2")).toBeInTheDocument();
    });

    it("곡 목록 영역을 왼쪽으로 80px 이상 쓸면 더 높은 난이도로, 오른쪽이면 더 낮은 난이도로 replace 이동한다 (맨 위로 올리지 않는다)", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      swipe(area(), -80);
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.9", { scroll: false });
      swipe(area(), 80);
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.0", { scroll: false });
      expect(replaceMock).toHaveBeenCalledTimes(2);
    });

    it("80px 미만이거나 가로축에서 30°를 벗어나면 이동하지 않는다 (곡 상세와 같은 규칙)", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      swipe(area(), -79);
      swipe(area(), -80, 90);
      swipe(area(), 80, -80);
      swipe(area(), -100, 58); // 약 30.1°
      expect(replaceMock).not.toHaveBeenCalled();
      swipe(area(), -100, 57); // 30° 이내
      expect(replaceMock).toHaveBeenCalledTimes(1);
    });

    it("화면 가장자리 24px에서 시작한 쓸기는 이동하지 않는다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      fireEvent.touchStart(area(), { touches: [{ clientX: 23, clientY: 300 }] });
      fireEvent.touchEnd(area(), { changedTouches: [{ clientX: 223, clientY: 300 }] });
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("끝 난이도에서 더 쓸면 이동하지 않는다 (예전의 튕김은 끌기 모션으로 대체됐다)", async () => {
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

  describe("D68: 방향 잠금 · 끌기 모션 · 이동 후 스크롤", () => {
    const area = () => screen.getByTestId("folder-swipe-area");
    const slider = () => screen.getByTestId("folder-slider");
    const bar = () => screen.getByRole("navigation", { name: "인접 난이도" });
    const tileHint = () => document.querySelector("[data-drag-hint]");
    const original = [...groups];
    const start = (el: Element, x = 200, y = 300) => fireEvent.touchStart(el, { touches: [{ clientX: x, clientY: y }] });
    const move = (el: Element, dx: number, dy = 0) => fireEvent.touchMove(el, { touches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
    const end = (el: Element, dx: number, dy = 0) => fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });

    afterEach(() => {
      groups.splice(0, groups.length, ...original);
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
    });

    it("세로로 시작한 쓸기는 중간에 가로로 휘어 80px를 넘어도 이동하지 않고, 목록도 움직이지 않는다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      start(area());
      move(area(), 3, 30); // 세로가 더 크다 -> 세로 잠금
      move(area(), -120, 30); // 이후 가로로 휘어도 무시
      expect(screen.queryByTestId("folder-neighbor-list")).not.toBeInTheDocument();
      expect(slider().style.transform).toBe("");
      end(area(), -120, 30);
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("가로로 시작한 쓸기는 잠긴 뒤 목록이 이동량의 절반만큼만 따라간다 (잠기기 전 10px 이내에는 움직이지 않는다)", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      start(area());
      move(area(), -8, 1); // 아직 10px 이내
      expect(screen.queryByTestId("folder-neighbor-list")).not.toBeInTheDocument();
      expect(slider().style.transform).toBe("");
      move(area(), -30, 2); // 잠김
      await waitFor(() => expect(slider().style.transform).toBe("translateX(-15px)"));
      move(area(), -100, 2);
      await waitFor(() => expect(slider().style.transform).toBe("translateX(-50px)"));
    });

    it("이웃 목록은 잠길 때만 생기고, 곡 줄 첫 8개만이며, 누를 수 없다 (aria-hidden·inert)", async () => {
      groups[0] = group(5.9, Array.from({ length: 12 }, (_, i) => `곡${i + 1}`));
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      expect(screen.queryByTestId("folder-neighbor-list")).not.toBeInTheDocument(); // 평소에는 그리지 않는다
      start(area());
      move(area(), -30, 0);
      const list = await screen.findByTestId("folder-neighbor-list");
      expect(list).toHaveAttribute("aria-hidden", "true");
      expect(list).toHaveAttribute("inert");
      expect(within(list).getAllByRole("heading", { name: /5\.9\s*12개/, hidden: true })).toHaveLength(1); // 머리는 전체 개수
      // 모바일 줄(EntryCard) 8개 + 데스크톱 표 줄(EntryRow) 8개
      expect(list.querySelectorAll("section ul > li")).toHaveLength(16);
      expect(within(list).queryByText("곡9")).not.toBeInTheDocument();
      expect(within(list).queryByRole("button", { name: /기록/ })).not.toBeInTheDocument(); // 담기·입력 버튼 없음
    });

    it("끌기 방향의 이웃을 보여 준다: 오른쪽으로 끌면 더 낮은 난이도", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      start(area());
      move(area(), 40, 0);
      const list = await screen.findByTestId("folder-neighbor-list");
      expect(within(list).getAllByRole("heading", { name: /5\.0\s*1개/, hidden: true })).toHaveLength(1);
      expect(screen.getByTestId("folder-drag-pill")).toHaveTextContent("‹ 5.0");
    });

    it("80px 전에는 알약 `5.7 ›`와 흐린 타일 테두리, 넘기면 `놓으면 이동`과 진한 테두리, 스테퍼의 이웃 숫자가 선택 상태가 된다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      start(area());
      move(area(), -60, 0);
      const pill = await screen.findByTestId("folder-drag-pill");
      expect(pill).toHaveTextContent("5.9 ›");
      expect(pill).not.toHaveTextContent("놓으면 이동");
      expect(tileHint()).toHaveAttribute("data-drag-hint", "weak");
      expect(tileHint()).toHaveTextContent("5.9");
      expect(bar().querySelector("[data-selected]")).toBeNull();

      move(area(), -90, 0);
      await waitFor(() => expect(screen.getByTestId("folder-drag-pill")).toHaveTextContent("놓으면 이동"));
      expect(screen.getByTestId("folder-drag-pill")).toHaveTextContent("5.9 ›");
      expect(tileHint()).toHaveAttribute("data-drag-hint", "strong");
      const selected = bar().querySelector("[data-selected]");
      expect(selected).toHaveTextContent("5.9");
      expect(within(bar()).getByRole("button", { name: "다음 난이도 5.9" })).toContainElement(selected as HTMLElement);
    });

    it("80px 이상 놓으면 현재 목록이 밀려 나간 뒤(약 200ms) replace로 이동한다 (scroll: false)", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      start(area());
      move(area(), -40, 0);
      move(area(), -100, 0);
      end(area(), -100, 0);
      expect(replaceMock).not.toHaveBeenCalled(); // 애니메이션이 끝난 뒤에 주소를 바꾼다
      expect(slider().style.transition).toContain("transform");
      expect(slider().style.transform).toMatch(/^translateX\(-\d+px\)$/); // 이웃이 들어오는 자리까지
      expect(screen.queryByTestId("folder-drag-pill")).not.toBeInTheDocument(); // 이동 중에는 안내를 거둔다
      await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/table/folder/5.9", { scroll: false }));
      expect(replaceMock).toHaveBeenCalledTimes(1);
    });

    it("80px 미만으로 놓으면 이동하지 않고 제자리로 돌아온다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      start(area());
      move(area(), -40, 0);
      move(area(), -70, 0);
      end(area(), -70, 0);
      expect(slider().style.transform).toBe("translateX(0px)");
      await waitFor(() => expect(slider().style.transform).toBe(""));
      expect(screen.queryByTestId("folder-neighbor-list")).not.toBeInTheDocument();
      expect(tileHint()).toBeNull();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("끝 난이도: 22px까지만 따라가고 알약은 `마지막 난이도`, 놓으면 제자리로 돌아온다", async () => {
      renderView("5.9");
      await screen.findByRole("heading", { name: /5\.9\s*1개/ });
      start(area());
      move(area(), -30, 0);
      move(area(), -150, 0);
      await waitFor(() => expect(slider().style.transform).toBe("translateX(-22px)"));
      expect(screen.getByTestId("folder-drag-pill")).toHaveTextContent("마지막 난이도");
      expect(screen.queryByTestId("folder-neighbor-list")).not.toBeInTheDocument();
      expect(tileHint()).toBeNull();
      end(area(), -150, 0);
      await waitFor(() => expect(slider().style.transform).toBe(""));
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("움직임 줄이기: 목록은 움직이지 않고 이웃 목록도 없다. 타일 테두리·스테퍼 강조·알약만 보이고, 놓으면 즉시 이동한다", async () => {
      vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("prefers-reduced-motion"), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      start(area());
      move(area(), -40, 0);
      move(area(), -100, 0);
      expect(await screen.findByTestId("folder-drag-pill")).toHaveTextContent("놓으면 이동");
      expect(tileHint()).toHaveAttribute("data-drag-hint", "strong");
      expect(bar().querySelector("[data-selected]")).toHaveTextContent("5.9");
      expect(slider().style.transform).toBe("");
      expect(screen.queryByTestId("folder-neighbor-list")).not.toBeInTheDocument();
      end(area(), -100, 0);
      expect(replaceMock).toHaveBeenCalledWith("/table/folder/5.9", { scroll: false }); // 기다림 없이 즉시
    });

    it("끌던 중 페이지가 2px 이상 스크롤되면 이번 쓸기는 이동하지 않고 제자리로 돌아온다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      start(area());
      move(area(), -40, 0);
      await screen.findByTestId("folder-neighbor-list");
      Object.defineProperty(window, "scrollY", { value: 2, configurable: true, writable: true });
      move(area(), -120, 0);
      end(area(), -120, 0);
      await waitFor(() => expect(slider().style.transform).toBe(""));
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("터치가 취소(touchcancel)되면 끌던 목록이 제자리로 돌아온다", async () => {
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      start(area());
      move(area(), -40, 0);
      await screen.findByTestId("folder-neighbor-list");
      fireEvent.touchCancel(area());
      await waitFor(() => expect(screen.queryByTestId("folder-neighbor-list")).not.toBeInTheDocument());
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("이웃 이동 직후(표시가 있을 때) 목록 머리가 화면 위로 지나가 있으면 머리가 맨 위에 오도록 즉시 올린다", async () => {
      const scrollTo = vi.fn();
      vi.stubGlobal("scrollTo", scrollTo);
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: -300, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: -300, toJSON: () => ({}) });
      requestFolderScrollAdjust();
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      expect(scrollTo).toHaveBeenCalledWith({ top: -300, behavior: "instant" });
    });

    it("목록 머리가 보이는 위치면 스크롤하지 않고, 표시가 없으면(처음 들어옴·뒤로 가기) 건드리지 않는다", async () => {
      const scrollTo = vi.fn();
      vi.stubGlobal("scrollTo", scrollTo);
      const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 120, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 120, toJSON: () => ({}) });
      requestFolderScrollAdjust();
      const first = renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      expect(scrollTo).not.toHaveBeenCalled(); // 머리(120)가 화면 안
      first.unmount();
      rect.mockReturnValue({ top: -300, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: -300, toJSON: () => ({}) });
      renderView("5.8"); // 표시 없음
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("스와이프 이동과 아래 버튼 이동은 모두 이동 직전에 스크롤 맞춤 표시를 남긴다", async () => {
      takeFolderScrollAdjust(); // 다른 테스트가 남긴 표시 정리
      renderView("5.8");
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      fireEvent.click(within(bar()).getByRole("button", { name: "다음 난이도 5.9" }));
      expect(takeFolderScrollAdjust()).toBe(true);
      start(area());
      end(area(), -100, 0);
      expect(takeFolderScrollAdjust()).toBe(true);
    });
  });
});
