import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TierFolderView } from "@/components/table/TierFolderView";
import type { DifficultyTableResponse, PageResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { parseGridPattern } from "@/lib/pattern-grid";
import { rememberTableReturn, resetTableReturnForTest } from "@/lib/table-view-state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }) }));

const table: DifficultyTableResponse = { id: 3, name: "SRN+ 서열표", instrumentPart: "GUITAR", noteOption: "SUPER_RANDOM_PLUS", status: "ACTIVE", revision: 1 };

function entry(id: number, title: string, pattern: string): TableEntryResponse {
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
    pattern,
    patternUncertain: false,
    ratingEnabled: true,
    mine: null,
  };
}

const entries = [entry(1, "단일곡", "단일"), entry(2, "복합곡", "복합"), entry(3, "이중곡", "이중")];
const groups: TierGroupResponse[] = [
  { tier: 5.7, total: 3, recorded: 0, exc: 0, fc: 0, ss: 0, sPlus: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries },
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("속성별 화면에서 들어온 폴더 상세 (D93)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    resetTableReturnForTest();
    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      const page: PageResponse<TierGroupResponse> = { content: groups, page: 0, size: 20, totalElements: 1, totalPages: 1 };
      if (url.includes("/skills/me/play-level")) return Promise.resolve(json({ status: "NEW_PLAYER", tier: null }));
      if (url.includes("/skills/me")) return Promise.resolve(json({ single: [], other: [], singleLimit: 15, otherLimit: 25 }));
      return Promise.resolve(url.includes("/entries") ? json(page) : json([table]));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderView(initialPattern: Parameters<typeof TierFolderView>[0]["initialPattern"]) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <TierFolderView userId={1} param="5.7" initialPattern={initialPattern} />
      </QueryClientProvider>,
    );
  }

  it("?pattern=복합이면 그 속성 필터가 자동으로 걸린 채 열리고, 칩·안내·돌아가기 링크가 보인다", async () => {
    renderView("복합");
    expect(await screen.findByRole("heading", { name: /5\.7\s*1개/ })).toBeInTheDocument(); // 3곡 중 복합 1곡
    expect(screen.getAllByText("복합곡").length).toBeGreaterThan(0);
    expect(screen.queryByText("단일곡")).toBeNull();
    const bar = screen.getByTestId("pattern-from-grid");
    expect(within(bar).getByText("속성: 복합")).toBeInTheDocument();
    expect(within(bar).getByText("속성별 화면에서 고른 복합 필터가 자동으로 걸렸습니다. 이 폴더에만 적용되고, 다른 폴더로 옮기면 풀립니다.")).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "필터 초기화" })).toBeInTheDocument();
    expect(within(bar).getByRole("link", { name: "속성별로 돌아가기" })).toHaveAttribute("href", "/table?view=pattern");
  });

  it("`속성별로 돌아가기`는 떠날 때의 보기 상태(쿼리, 보기 방식 포함)로 돌아간다", async () => {
    rememberTableReturn({ query: "rec=all&view=pattern", scrollY: 10, unfolded: false });
    renderView("복합");
    await screen.findByRole("heading", { name: /5\.7/ });
    const href = screen.getByRole("link", { name: "속성별로 돌아가기" }).getAttribute("href");
    expect(href).toBe("/table?rec=all&view=pattern");
  });

  it("서열표에서 들어온 필터(추천)는 유지하고 속성만 주소 값으로 바꾼다", async () => {
    rememberTableReturn({ query: "rec=상&pat=단일&view=pattern", scrollY: 0, unfolded: false });
    renderView("이중");
    expect(await screen.findByRole("heading", { name: /5\.7\s*1개/ })).toBeInTheDocument();
    expect(screen.getAllByText("이중곡").length).toBeGreaterThan(0);
    expect(screen.queryByText("단일곡")).toBeNull(); // 저장된 pat=단일이 아니라 주소의 이중
  });

  it("칩의 ✕를 누르면 속성 필터만 풀리고(전체 곡) 안내는 사라지며 돌아가기 링크는 남는다", async () => {
    renderView("복합");
    await screen.findByRole("heading", { name: /5\.7\s*1개/ });
    fireEvent.click(screen.getByRole("button", { name: "복합 속성 필터 해제" }));
    expect(await screen.findByRole("heading", { name: /5\.7\s*3개/ })).toBeInTheDocument();
    expect(screen.getAllByText("단일곡").length).toBeGreaterThan(0);
    const bar = screen.getByTestId("pattern-from-grid");
    expect(within(bar).queryByText(/속성: 복합/)).toBeNull();
    expect(within(bar).queryByText(/자동으로 걸렸습니다/)).toBeNull();
    expect(within(bar).getByRole("link", { name: "속성별로 돌아가기" })).toBeInTheDocument();
    expect(within(bar).queryByRole("button", { name: "필터 초기화" })).toBeNull(); // 걸린 필터가 없으면 초기화도 없다
  });

  it("필터 초기화는 걸린 필터를 모두 푼다", async () => {
    rememberTableReturn({ query: "rec=상", scrollY: 0, unfolded: false });
    renderView("복합");
    await screen.findByRole("heading", { name: /5\.7\s*1개/ });
    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(await screen.findByRole("heading", { name: /5\.7\s*3개/ })).toBeInTheDocument();
    expect(screen.queryByText(/속성: 복합/)).toBeNull();
  });

  it("속성 값이 없으면 띠가 없고 폴더 전체를 보여 준다 (알 수 없는 값은 parseGridPattern이 null로 거른다)", async () => {
    expect(parseGridPattern("아무거나")).toBeNull();
    renderView(parseGridPattern("아무거나"));
    expect(await screen.findByRole("heading", { name: /5\.7\s*3개/ })).toBeInTheDocument();
    expect(screen.queryByTestId("pattern-from-grid")).toBeNull();
  });
});
