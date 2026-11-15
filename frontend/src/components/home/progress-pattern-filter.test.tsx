import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { ProgressTiles } from "@/components/home/ProgressTiles";
import type { ChartFolderListResponse, ChartFolderResponse, DifficultyTableResponse, PageResponse, SkillResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import type { ProgressGroup } from "@/lib/difficulty-table";
import { PROGRESS_PATTERN_KEY, resetProgressPatternForTest } from "@/lib/progress-pattern";
import { WELCOME_HIDDEN_KEY, resetWelcomeGuideForTest } from "@/lib/welcome-guide";

const table: DifficultyTableResponse = { id: 3, name: "SRN+ 서열표", instrumentPart: "GUITAR", noteOption: "SUPER_RANDOM_PLUS", status: "ACTIVE", revision: 1 };
const skill = { noteOption: "SUPER_RANDOM_PLUS", totalScore: 1, singleScore: 1, otherScore: 0, tier: { key: "WHITE", displayName: "White", minScore: 0, nextMinScore: 500, nextDisplayName: "Gray" }, singleLimit: 15, otherLimit: 25, single: [{ songDifficultyId: 1 }], other: [] } as unknown as SkillResponse;

function entry(pattern: string | null, stage: string | null): TableEntryResponse {
  return { part: "GUITAR", recommend: null, pattern, mine: stage === null ? null : { rate: 99, fullCombo: false, stage } } as unknown as TableEntryResponse;
}
function tierGroup(tier: number, entries: TableEntryResponse[]): TierGroupResponse {
  const count = (stage: string) => entries.filter((e) => e.mine?.stage === stage).length;
  const recorded = entries.filter((e) => e.mine !== null).length;
  const [exc, fc, ss, sPlus, s] = ["EXC", "FC", "SS", "S+", "S"].map(count);
  return { tier, total: entries.length, recorded, exc, fc, ss, sPlus, s, belowS: recorded - exc - fc - ss - sPlus - s, averageRecorded: null, averageWithZero: 0, entries };
}
// 6.0: 단일 EXC·단일 SS·복합 기록 없음 / 5.0: 이중 S+ / 속성 없는 채보(레이팅 제외) EXC 하나는 전체에만 들어간다
const groups = [
  tierGroup(6.0, [entry("단일", "EXC"), entry("단일", "SS"), entry("복합", null)]),
  tierGroup(5.0, [entry("이중", "S+"), entry("레이팅 제외", "EXC")]),
];

function folder(over: Partial<ChartFolderResponse>): ChartFolderResponse {
  return { lo: 9.5, hi: 9.99, total: 10, recorded: 6, exc: 1, fc: 1, ss: 1, sPlus: 0, s: 2, belowS: 1, averageRecorded: 90, averageWithZero: 54, subFolders: [], ...over };
}
const allFolders: ChartFolderListResponse = { totalSongs: 30, totalCharts: 30, versions: [], folders: [folder({ total: 30 })], patternCounts: { 단일: 12, 복합: 10, 이중: 5, 삼중: 1 } };
const singleFolders: ChartFolderListResponse = { ...allFolders, totalCharts: 12, folders: [folder({ total: 12, recorded: 2, exc: 2, fc: 0, ss: 0, s: 0, belowS: 0 })] };

/** 도넛 오른쪽 `기록 4 / 5곡`. 숫자가 여러 노드로 나뉘어 있어 글자 전체로 찾는다 */
const donutRecord = (text: string) => {
  const [recorded, total] = text.split("/");
  return screen.findByText((_, el) => el?.tagName === "P" && el.textContent === `기록 ${recorded} / ${total}곡`);
};

describe("홈 진행도 속성 필터", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  const folderUrls: string[] = [];

  function renderHome() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <HomeDashboard userId={1} name="홍길동" />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    fetchMock.mockReset();
    folderUrls.length = 0;
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
    resetProgressPatternForTest();
    resetWelcomeGuideForTest();
    localStorage.setItem(WELCOME_HIDDEN_KEY, "1");
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/songs/chart-folders")) {
        folderUrls.push(url);
        return Promise.resolve(json(url.includes("pattern=") ? singleFolders : allFolders));
      }
      if (url.includes("/skills/me")) return Promise.resolve(json(skill));
      if (url.includes("/notices") || url.includes("/players")) return Promise.resolve(json({ content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 } as PageResponse<unknown>));
      if (url.includes("/entries")) return Promise.resolve(json({ content: groups, page: 0, size: 20, totalElements: 2, totalPages: 1 } as PageResponse<TierGroupResponse>));
      return Promise.resolve(json([table]));
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function chips() {
    return within(await screen.findByRole("group", { name: "속성 필터" }));
  }

  it("서열표 탭: 칩마다 채보 수가 붙고(속성 없는 채보는 전체에만), 속성을 고르면 링·난이도 행이 다시 집계되고 채보 없는 행은 숨는다", async () => {
    renderHome();
    const bar = await chips();
    expect(bar.getByRole("button", { name: "전체 5" })).toHaveAttribute("aria-pressed", "true");
    expect(bar.getByRole("button", { name: "단일 2" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "복합 1" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "이중 1" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "삼중 0" })).toBeInTheDocument();

    const rows = () => within(screen.getByRole("list", { name: "묶음별 진행" }));
    expect(rows().getAllByRole("link")).toHaveLength(2); // 6.0, 5.0
    expect(await donutRecord("4/5")).toBeInTheDocument(); // 전체: 기록 4 / 채보 5 (도넛 가운데)

    fireEvent.click(bar.getByRole("button", { name: "단일 2" }));
    expect(bar.getByRole("button", { name: "단일 2" })).toHaveAttribute("aria-pressed", "true");
    expect(await donutRecord("2/2")).toBeInTheDocument(); // 단일: 기록 2 / 채보 2
    expect(rows().getAllByRole("link")).toHaveLength(1); // 5.0 행은 단일 채보가 없어 숨는다
    expect(rows().getByRole("link", { name: /6\.0/ })).toBeInTheDocument();
    // 칩 숫자는 필터를 걸어도 그대로다
    expect(bar.getByRole("button", { name: "전체 5" })).toBeInTheDocument();
  });

  it("고른 속성은 이 기기에 속성 값만 저장하고, 다음 방문에서 그 속성으로 시작한다", async () => {
    const first = renderHome();
    fireEvent.click((await chips()).getByRole("button", { name: "이중 1" }));
    expect(localStorage.getItem(PROGRESS_PATTERN_KEY)).toBe("이중");
    first.unmount();

    resetProgressPatternForTest(); // 새로 방문한 것처럼 메모리 값을 비운다
    renderHome();
    expect((await chips()).getByRole("button", { name: "이중 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("저장된 값이 칩에 없는 값이면 전체로 시작한다", async () => {
    localStorage.setItem(PROGRESS_PATTERN_KEY, "복합(단일)");
    resetProgressPatternForTest();
    renderHome();
    expect((await chips()).getByRole("button", { name: "전체 5" })).toHaveAttribute("aria-pressed", "true");
  });

  it("localStorage를 읽고 쓸 수 없어도 동작한다(이번 화면에서만 바뀐다)", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    resetProgressPatternForTest();
    renderHome();
    const bar = await chips();
    expect(bar.getByRole("button", { name: "전체 5" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(bar.getByRole("button", { name: "단일 2" }));
    expect(bar.getByRole("button", { name: "단일 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("곡 목록 탭: 칩 숫자는 서버의 속성별 개수이고, 속성을 고르면 서버에 pattern을 보내 다시 받는다", async () => {
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "곡 목록" }));
    const bar = await chips();
    expect(bar.getByRole("button", { name: "전체 30" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "단일 12" })).toBeInTheDocument();
    // 처음에는 속성 없이 받는다
    expect(folderUrls.every((u) => !u.includes("pattern="))).toBe(true);

    const singleChip = bar.getByRole("button", { name: "단일 12" });
    fireEvent.click(singleChip);
    await waitFor(() => expect(folderUrls.some((u) => u.includes("pattern=%EB%8B%A8%EC%9D%BC"))).toBe(true));
    expect(await donutRecord("2/12")).toBeInTheDocument(); // 서버가 거른 폴더 합계
    // 새 속성을 받는 동안 카드가 불러오는 상태를 거쳐도 칩은 다시 만들어지지 않는다(키보드 초점 유지)
    expect(singleChip).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "전체 30" })).toBeInTheDocument(); // 칩 숫자는 흔들리지 않는다
  });

  it("고른 속성의 채보가 없으면 빈 도넛 대신 안내를 보인다", async () => {
    renderHome();
    fireEvent.click((await chips()).getByRole("button", { name: "삼중 0" }));
    expect(await screen.findByText("이 속성의 채보가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "묶음별 진행" })).toBeNull();
  });
});

describe("진행도 칸 지도의 난이도 색 (전곡 완료)", () => {
  function group(over: Partial<ProgressGroup>): ProgressGroup {
    return { key: "6.0", label: "6.0", href: "/table/folder/6.0", total: 4, recorded: 4, exc: 0, fc: 0, ss: 0, sPlus: 0, s: 0, belowS: 0, ...over };
  }
  const link = (label: RegExp) => screen.getByRole("link", { name: label });

  it("전곡 기록이 있으면 가장 낮은 단계의 색·세로 막대·`S+↑` 글자가 붙고, 단계 이름은 읽는 글자로도 전한다", () => {
    render(<ProgressTiles label="칸" groups={[group({ exc: 1, fc: 1, ss: 1, sPlus: 1 })]} />);
    const row = link(/6\.0/);
    expect(row.querySelector("[data-full-bar]")).toHaveAttribute("data-stage", "S+");
    expect(row.querySelectorAll("[data-full-stage='S+']").length).toBeGreaterThan(0);
    expect(row).toHaveTextContent("S+↑");
    expect(row).toHaveTextContent("모든 채보가 S+ 이상입니다.");
    // 숫자(난이도)가 단계 색 글자다
    expect(row.querySelector("span.stage-text[data-stage='S+'].font-bold")).toHaveTextContent("6.0");
  });

  it("모바일 표형 줄(시안 Home4): 값이 있는 칸은 단계 색 칩, 없는 칸은 `-`이고, 줄 아래에 단계 비율 막대가 있다", () => {
    render(<ProgressTiles label="칸" groups={[group({ total: 25, recorded: 25, exc: 20, fc: 5 })]} />);
    const row = link(/6\.0/);
    const chips = Array.from(row.querySelectorAll("span.rounded-\\[7px\\]"));
    expect(chips.map((el) => el.textContent?.replace(/^.* /, ""))).toEqual(["20", "5", "-", "-", "-", "-"]);
    expect(chips[0]).toHaveAttribute("data-stage", "EXC");
    expect(chips[0].getAttribute("style")).toContain("color-mix");
    expect(chips[2].getAttribute("data-stage")).toBeNull();
    expect(row.querySelectorAll("[data-stage-bar]").length).toBeGreaterThan(0);
  });

  it("가장 낮은 단계가 EXC면 금 그라데이션 글자, FC면 하늘 그라데이션 글자다", () => {
    render(
      <ProgressTiles
        label="칸"
        groups={[group({ key: "7.0", label: "7.0", exc: 4 }), group({ key: "6.8", label: "6.8", exc: 3, fc: 1 })]}
      />,
    );
    expect(link(/7\.0/).querySelector(".stage-grad-text[data-stage='EXC']")).toHaveTextContent("7.0");
    expect(link(/7\.0/)).toHaveTextContent("모든 채보가 EXC입니다.");
    expect(link(/7\.0/)).toHaveTextContent("EXC↑"); // 시안 Home4: EXC도 화살표가 붙는다
    expect(link(/6\.8/).querySelector(".stage-grad-text[data-stage='FC']")).toHaveTextContent("6.8");
    expect(link(/6\.8/)).toHaveTextContent("FC↑");
  });

  it("기록 없는 채보가 있거나 가장 낮은 단계가 S 미만이면 색·막대·글자가 없다", () => {
    render(
      <ProgressTiles
        label="칸"
        groups={[group({ key: "5.0", label: "5.0", recorded: 3, exc: 3 }), group({ key: "5.5", label: "5.5", exc: 3, belowS: 1 })]}
      />,
    );
    for (const label of [/5\.0/, /5\.5/]) {
      const row = link(label);
      expect(row.querySelector("[data-full-bar]")).toBeNull();
      expect(row.querySelector("[data-full-stage]")).toBeNull();
      expect(row.querySelector(".stage-grad-text")).toBeNull();
      expect(row).not.toHaveTextContent("↑");
    }
  });
});
