import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatingTargetPlanner } from "@/components/rating/RatingTargetPlanner";
import type { DifficultyTableResponse, SkillEntryResponse, SkillResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

const table: DifficultyTableResponse = { id: 3, name: "SRN+ 서열표", instrumentPart: "GUITAR", noteOption: "SUPER_RANDOM_PLUS", status: "ACTIVE", revision: 1 };

function skillEntry(rank: number, score: number): SkillEntryResponse {
  return {
    rank, songDifficultyId: rank, songId: rank, title: `내곡${rank}`, part: "GUITAR", difficulty: "MASTER", level: 9, tier: 6,
    pattern: "단일", achievementRate: 90, fullCombo: false, stage: "S", ratingConstant: 15, value: score / 20, score,
  };
}
function skill(over: Partial<SkillResponse> = {}): SkillResponse {
  return {
    noteOption: "SUPER_RANDOM_PLUS", totalScore: 1000, singleScore: 600, otherScore: 400,
    tier: { key: "ORANGE", displayName: "Orange", minScore: 1000, nextDisplayName: null, nextMinScore: null },
    singleLimit: 15, otherLimit: 25,
    // 단일 15곡: 1위 300, 7위 294, 15위 286
    single: Array.from({ length: 15 }, (_, i) => skillEntry(i + 1, 300 - i)),
    other: [],
    ...over,
  };
}

function entry(id: number, title: string, over: Partial<TableEntryResponse> = {}): TableEntryResponse {
  return {
    entryId: id, songDifficultyId: id, songId: id, title, addedVersion: null, part: "GUITAR", difficulty: "MASTER", level: 9.5,
    tierUncertain: false, recommend: "상", recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true, mine: null, ...over,
  };
}
function group(tier: number | null, entries: TableEntryResponse[]): TierGroupResponse {
  return { tier, total: entries.length, recorded: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries };
}

describe("RatingTargetPlanner", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

  function renderPlanner(s: SkillResponse = skill()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <RatingTargetPlanner userId={1} skill={s} />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    fetchMock.mockReset();
    const groups = [group(7.0, [entry(1, "일곱곡")]), group(6.0, [entry(2, "여섯곡", { mine: { rate: 90, fullCombo: false, stage: "S" } })]), group(5.0, [entry(3, "다섯곡")])];
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("/entries") ? json({ content: groups, page: 0, size: 20, totalElements: 3, totalPages: 1 }) : json([table]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("처음에는 접혀 있고 서열표를 요청하지 않는다", () => {
    renderPlanner();
    expect(screen.getByRole("button", { name: /레이팅 예상 값/ })).toHaveAttribute("aria-expanded", "false");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("펼치면 단일의 1·7·15위 점수와 난이도별 필요 달성률을 보여 준다 (낼 수 없는 난이도는 불가)", async () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /레이팅 예상 값/ }));
    const list = await screen.findByRole("region", { name: "단일 레이팅 예상 값" });
    expect(within(list).getByText("1위 점수")).toBeInTheDocument();
    expect(within(list).getByText("7위 점수")).toBeInTheDocument();
    expect(within(list).getByText("15위 점수")).toBeInTheDocument();
    expect(within(list).getByText("300.00")).toBeInTheDocument();

    // 7.0(R=20): V=15 → 80%(=16)보다 아래라 75.00% / 6.0(R=15): V=15 > 12 → 80 + 3/3.2×15 = 94.06…% → 올림 94.07%
    const rows = within(list).getAllByRole("button");
    expect(rows[0]).toHaveTextContent("7.0");
    expect(rows[0]).toHaveTextContent("75.00%");
    expect(rows[1]).toHaveTextContent("6.0");
    expect(rows[1]).toHaveTextContent("94.07%");
    // 5.0(R=5)은 어느 점수도 낼 수 없어 목록에서 빠진다
    expect(rows).toHaveLength(2);
  });

  it("복합·이중·삼중 목록이 비어 있으면 그 구역은 그리지 않는다", async () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /레이팅 예상 값/ }));
    await screen.findByRole("region", { name: "단일 레이팅 예상 값" });
    expect(screen.queryByRole("region", { name: "복합·이중·삼중 레이팅 예상 값" })).not.toBeInTheDocument();
  });

  it("난이도를 누르면 그 난이도의 채보 목록이 펼쳐지고 곡 상세로 가는 링크가 있다", async () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /레이팅 예상 값/ }));
    const list = await screen.findByRole("region", { name: "단일 레이팅 예상 값" });
    expect(screen.queryByText("여섯곡")).not.toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: /난이도 6\.0/ }));
    const link = within(list).getByRole("link", { name: /여섯곡/ });
    expect(link).toHaveAttribute("href", "/songs/2?from=table&chart=2");
    expect(link).toHaveTextContent("90.00"); // 내 기록
    fireEvent.click(within(list).getByRole("button", { name: /난이도 6\.0/ }));
    expect(screen.queryByText("여섯곡")).not.toBeInTheDocument();
  });

  it("목록 순위가 덜 찼으면 있는 순위의 점수만 보인다", async () => {
    renderPlanner(skill({ single: Array.from({ length: 8 }, (_, i) => skillEntry(i + 1, 300 - i)) }));
    fireEvent.click(screen.getByRole("button", { name: /레이팅 예상 값/ }));
    const list = await screen.findByRole("region", { name: "단일 레이팅 예상 값" });
    expect(within(list).getByText("7위 점수")).toBeInTheDocument();
    expect(within(list).queryByText("15위 점수")).not.toBeInTheDocument();
  });

  it("기록이 하나도 없으면 안내만 보인다", async () => {
    renderPlanner(skill({ single: [], other: [] }));
    fireEvent.click(screen.getByRole("button", { name: /레이팅 예상 값/ }));
    expect(await screen.findByText("레이팅 목록에 기록이 생기면 기준 점수가 여기에 나옵니다.")).toBeInTheDocument();
  });
});
