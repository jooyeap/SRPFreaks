import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DifficultyTableView } from "@/components/table/DifficultyTableView";
import { PatternGridView } from "@/components/table/PatternGridView";
import type { AchievementStage } from "@/lib/types";
import type { DifficultyTableResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { EMPTY_FILTERS } from "@/lib/difficulty-table";
import { resetTableTilesForTest } from "@/lib/table-tiles";
import { DEFAULT_VIEW_STATE, readTableReturn, resetTableReturnForTest, type TableViewState } from "@/lib/table-view-state";

const table: DifficultyTableResponse = { id: 3, name: "SRN+ 서열표", instrumentPart: "GUITAR", noteOption: "SUPER_RANDOM_PLUS", status: "ACTIVE", revision: 1 };

let nextId = 1;
function entry(pattern: string | null, stage: string | null): TableEntryResponse {
  const id = nextId++;
  return {
    entryId: id,
    songDifficultyId: id,
    songId: id,
    title: `곡${id}`,
    addedVersion: "V1",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend: "상",
    recommendUncertain: false,
    pattern,
    patternUncertain: false,
    ratingEnabled: true,
    mine: stage === null ? null : { rate: 90, fullCombo: false, stage: stage as AchievementStage },
  };
}
function group(tier: number, entries: TableEntryResponse[]): TierGroupResponse {
  return { tier, total: entries.length, recorded: 0, exc: 0, fc: 0, ss: 0, sPlus: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries };
}

/**
 * 5.9: 단일 2곡 전부 S+ 이상(S+, SS) → 완료(가장 낮은 단계 S+) / 복합 1곡 기록 없음 / 이중·삼중 없음
 * 5.8: 단일 S 1/2 / 복합 SS 전곡이지만 이중 A(S 미만) 전곡 기록
 */
function sample(): TierGroupResponse[] {
  return [
    group(5.9, [entry("단일", "S+"), entry("단일", "SS"), entry("복합", null)]),
    group(5.8, [entry("단일", "S"), entry("단일", null), entry("이중", "A")]),
  ];
}

function renderGrid(groups = sample(), over: Partial<Parameters<typeof PatternGridView>[0]> = {}) {
  return render(<PatternGridView groups={groups} filters={EMPTY_FILTERS} average={null} order="hard" returnQuery="view=pattern" {...over} />);
}

describe("PatternGridView (속성별 화면)", () => {
  beforeEach(() => resetTableReturnForTest());

  it("제목 `폴더 × 속성`과 안내, 열 머리(속성 + 채보 수), 행 머리(기준 난이도)가 있다", () => {
    renderGrid();
    expect(screen.getByRole("heading", { name: "폴더 × 속성" })).toBeInTheDocument();
    expect(screen.getByText("칸을 누르면 그 폴더로 이동")).toBeInTheDocument();
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["기준 난이도", "단일4", "복합1", "이중1", "삼중0"]);
    expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["5.9", "5.8"]); // 어려운 순
  });

  it("칸 이름은 `격자`가 아니라 `속성별`이고, 어디에도 `격자`라는 말이 없다", () => {
    renderGrid();
    expect(document.body.textContent).not.toContain("격자");
  });

  it("칸을 누르면 `/table/folder/{폴더}?pattern={속성}`으로 가고 돌아올 화면(쿼리·스크롤)을 기억한다", () => {
    renderGrid();
    const cell = screen.getByRole("link", { name: /5\.9 복합/ });
    expect(decodeURIComponent(cell.getAttribute("href") ?? "")).toBe("/table/folder/5.9?pattern=복합");
    expect(screen.getByRole("link", { name: /5\.8 이중/ }).getAttribute("href")).toBe(`/table/folder/5.8?pattern=${encodeURIComponent("이중")}`);
    fireEvent.click(cell);
    expect(readTableReturn()).toMatchObject({ query: "view=pattern", unfolded: false });
  });

  it("칸에는 기록/전체가 있고 기록이 없으면 점선 칸 + `기록 없음`, 곡이 없으면 `–`(링크 아님)", () => {
    renderGrid();
    const empty = screen.getByRole("link", { name: /5\.9 복합/ });
    expect(empty).toHaveClass("border-dashed");
    expect(empty).toHaveTextContent("0/1");
    expect(empty).toHaveTextContent("기록 없음");
    const half = screen.getByRole("link", { name: /5\.8 단일/ });
    expect(half).toHaveTextContent("1/2");
    expect(half).not.toHaveClass("border-dashed");
    expect(half.querySelector("[data-stage-bar]")?.className).toContain("h-[3px]"); // 칸 아래 3px 단계 분포 선
    // 5.9의 이중·삼중은 곡이 없다
    expect(screen.queryByRole("link", { name: /5\.9 이중/ })).toBeNull();
    expect(screen.getAllByText("–")).toHaveLength(4); // 5.9 이중·삼중 + 5.8 복합·삼중
    expect(screen.getByText(/5\.9 이중 곡 없음/)).toHaveClass("sr-only");
  });

  it("전곡 기록 칸(S 이상)은 ✓ 동그라미(단계 색) + 옅은 배경 + 단계 색 글자이고, 읽는 글자가 있다", () => {
    renderGrid();
    const done = screen.getByRole("link", { name: /5\.9 단일/ });
    expect(done).toHaveAttribute("data-done", "true");
    expect(done).toHaveAttribute("data-stage", "S+"); // 가장 낮은 단계
    const check = done.querySelector("[data-full-check]") as HTMLElement;
    expect(check).toHaveTextContent("✓");
    expect(check).toHaveAttribute("aria-hidden", "true");
    expect(check).toHaveClass("stage-bar", "rounded-full");
    expect(done.className).toContain("var(--done-tint)");
    expect(done.className).toContain("var(--st-text)"); // 단계 색 테두리
    expect(done).toHaveTextContent("2/2");
    expect(within(done).getByText(/모든 채보가 S\+ 이상입니다/)).toHaveClass("sr-only");
  });

  it("일부만 기록한 칸·S 미만이 섞인 전곡 기록 칸에는 ✓가 없다", () => {
    renderGrid();
    expect(screen.getByRole("link", { name: /5\.8 단일/ }).querySelector("[data-full-check]")).toBeNull();
    const mixed = screen.getByRole("link", { name: /5\.8 이중/ }); // 1/1이지만 A(S 미만)
    expect(mixed).toHaveAttribute("data-done", "true");
    expect(mixed.querySelector("[data-full-check]")).toBeNull();
    expect(mixed).not.toHaveAttribute("data-stage");
  });

  it("내 평균 폴더는 행 숫자만 굵고 크게 하고, 눈에 보이는 `내 평균` 글자는 없다 (읽는 글자만)", () => {
    renderGrid(sample(), { average: 5.8 });
    const rows = screen.getAllByRole("rowheader");
    const avg = rows.find((r) => r.textContent?.startsWith("5.8"))!;
    const other = rows.find((r) => r.textContent?.startsWith("5.9"))!;
    expect(avg).toHaveClass("font-bold", "text-lg");
    expect(other).not.toHaveClass("text-lg");
    expect(within(avg).getByText(/내 평균 난이도/)).toHaveClass("sr-only");
    const visible = [...document.body.querySelectorAll("*")].filter((el) => !el.classList.contains("sr-only") && el.children.length === 0 && /내 평균/.test(el.textContent ?? ""));
    expect(visible).toHaveLength(0);
    expect(document.querySelector("tr[data-average='true']")).toBe(avg.closest("tr"));
  });

  it("쉬운 순이면 행이 낮은 난이도부터 나온다", () => {
    renderGrid(sample(), { order: "easy" });
    expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["5.8", "5.9"]);
  });

  it("색은 CSS 변수만 쓴다: 클래스·style에 색 값(#, rgb)이 없다", () => {
    renderGrid();
    expect(document.body.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(document.body.innerHTML).not.toMatch(/rgba?\(/);
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("서열표 `폴더 | 속성별` 전환 (D93)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    resetTableTilesForTest();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/skills/me/play-level")) return Promise.resolve(json({ status: "NEW_PLAYER", tier: null }));
      if (url.includes("/entries")) return Promise.resolve(json({ content: sample(), page: 0, size: 20, totalElements: 2, totalPages: 1 }));
      return Promise.resolve(json([table]));
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderView(state: TableViewState, onStateChange = vi.fn()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DifficultyTableView userId={1} state={state} onStateChange={onStateChange} />
      </QueryClientProvider>,
    );
    return onStateChange;
  }

  it("폴더 화면에는 `폴더 | 속성별` 스위치가 있고 폴더가 눌려 있다. 속성별을 누르면 mode: pattern으로 바뀐다", async () => {
    const onChange = renderView({ ...DEFAULT_VIEW_STATE, filters: EMPTY_FILTERS });
    await screen.findByRole("list", { name: "난이도 목록" });
    const group = screen.getByRole("group", { name: "보기 방식" });
    expect(within(group).getByRole("button", { name: "폴더" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "속성별" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("heading", { name: "폴더 × 속성" })).toBeNull();
    fireEvent.click(within(group).getByRole("button", { name: "속성별" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: "pattern" }));
  });

  it("mode가 pattern이면 타일 대신 속성별 화면이 나오고 스위치는 속성별이 눌려 있다 (폴더 상세에서 돌아와도 같은 상태)", async () => {
    renderView({ ...DEFAULT_VIEW_STATE, filters: EMPTY_FILTERS, mode: "pattern" });
    expect(await screen.findByRole("heading", { name: "폴더 × 속성" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "난이도 목록" })).toBeNull();
    const group = screen.getByRole("group", { name: "보기 방식" });
    expect(within(group).getByRole("button", { name: "속성별" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: /5\.9 복합/ })).toBeInTheDocument();
  });

  it("속성별 화면에서는 필터 패널에 속성 필터가 없다 (열이 속성)", async () => {
    renderView({ ...DEFAULT_VIEW_STATE, filters: EMPTY_FILTERS, mode: "pattern" });
    await screen.findByRole("heading", { name: "폴더 × 속성" });
    fireEvent.click(screen.getByRole("button", { name: /필터/ }));
    const panel = document.getElementById("table-filters") as HTMLElement;
    expect(within(panel).getByText("추천")).toBeInTheDocument();
    expect(within(panel).queryByText("속성")).toBeNull();
  });
});
