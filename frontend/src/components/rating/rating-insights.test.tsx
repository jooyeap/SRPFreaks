import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatingInsights } from "@/components/rating/RatingInsights";
import { ToastProvider } from "@/components/Toast";
import type { SkillEntryResponse, SkillResponse, SkillSnapshotStatusResponse, SnapshotCompareResponse } from "@/lib/api-types";

function entry(rank: number, title: string, score: number): SkillEntryResponse {
  return {
    rank, songDifficultyId: rank, songId: rank, title, part: "GUITAR", difficulty: "MASTER", level: 9, tier: 6, pattern: "단일",
    achievementRate: 90, fullCombo: false, stage: "S", ratingConstant: 15, value: score / 20, score,
  };
}

const orange = { key: "ORANGE", displayName: "Orange", minScore: 1000, nextDisplayName: "Orange Gradient", nextMinScore: 1500 };

function skill(over: Partial<SkillResponse> = {}): SkillResponse {
  return {
    noteOption: "SUPER_RANDOM_PLUS", totalScore: 1400, singleScore: 700, otherScore: 700, tier: orange,
    singleLimit: 3, otherLimit: 3,
    single: [entry(1, "단일1", 400), entry(2, "단일2", 301), entry(3, "단일3", 300)],
    other: [entry(1, "그외1", 500)],
    ...over,
  };
}

const compareOk: SnapshotCompareResponse = {
  available: true, reason: null, fromDate: "2026-10-10", toDate: null, fromTotal: 1366.08, toTotal: 1400, totalChange: 33.92,
  entered: [{ songDifficultyId: 9, songId: 9, title: "신곡", part: "GUITAR", difficulty: "MASTER", group: "SINGLE", rateBefore: null, rateAfter: 95, scoreBefore: null, scoreAfter: 280 }],
  improved: [], declined: [], left: [],
};

describe("RatingInsights", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let status: SkillSnapshotStatusResponse;
  let compare: SnapshotCompareResponse;
  const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } });

  function renderInsights(s: SkillResponse = skill()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <RatingInsights userId={1} skill={s} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    status = { available: true, reason: null };
    compare = compareOk;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "POST") return Promise.resolve(json({ id: 3, date: "2026-10-16", totalScore: 1400, singleScore: 700, otherScore: 700, change: 33.92 }, 201));
      if (url.includes("/snapshots/status")) return Promise.resolve(json(status));
      if (url.includes("/compare-current")) return Promise.resolve(json(compare));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("오늘 기록할 수 있으면 변화량과 함께 기록 제안을 눈에 띄게 보여 주고, 누르면 기록한다", async () => {
    renderInsights();
    const banner = await screen.findByRole("region", { name: "레이팅 기록 제안" });
    expect(await within(banner).findByText(/마지막 기록\(2026-10-10\) 이후 레이팅이 ▲ \+33\.92 달라졌습니다\./)).toBeInTheDocument();
    fireEvent.click(within(banner).getByRole("button", { name: "지금 레이팅 기록하기" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(true));
  });

  it("기록할 수 없는 날(이미 기록 / 변경 없음)에는 제안을 보이지 않는다", async () => {
    status = { available: false, reason: "ALREADY_TODAY" };
    renderInsights();
    await screen.findByText(/새로 들어온 곡/); // 요약은 보인다
    expect(screen.queryByRole("region", { name: "레이팅 기록 제안" })).toBeNull();
  });

  it("처음이면(기록 없음) 첫 기록을 권한다", async () => {
    compare = { ...compareOk, available: false, reason: "NO_SNAPSHOT", totalChange: null as unknown as number };
    renderInsights();
    expect(await screen.findByText("아직 기록한 레이팅이 없습니다.")).toBeInTheDocument();
  });

  it("요약 한 줄은 변화량과 새로 들어온 곡 수를 보이고, 누르면 곡별 비교를 펼친다", async () => {
    renderInsights();
    const summary = await screen.findByRole("button", { name: /마지막 기록\(2026-10-10\) 대비/ });
    expect(summary).toHaveTextContent("▲ +33.92");
    expect(summary).toHaveTextContent("새로 들어온 곡 1개");
    expect(summary).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(summary);
    expect(await screen.findByRole("region", { name: "새로 들어온 곡" })).toHaveTextContent("신곡");
  });

  it("목표 안내: 꽉 찬 구역은 밀려나는 곡 점수를 같이 알려 준다", async () => {
    renderInsights();
    // 남은 점수 100. 단일은 꽉 참(맨 아래 300) -> 400 필요, 그 외는 덜 참 -> 100만 필요 -> 그 외 구역이 더 쉽다
    expect(await screen.findByText(/다음 티어 Orange Gradient까지/)).toHaveTextContent("복합·이중·삼중에서 100.00점 이상인 곡이 하나 들어오면 도달합니다.");
  });

  it("곧 빠질 곡은 꽉 찬 구역에서 맨 아래 곡과 점수가 비슷한 곡만 보인다", async () => {
    renderInsights();
    const section = await screen.findByRole("region", { name: "곧 빠질 곡" });
    const list = within(section).getByRole("list", { name: "단일 곧 빠질 곡" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("단일2"),
      expect.stringContaining("단일3"),
    ]);
    expect(within(section).queryByRole("list", { name: "복합·이중·삼중 곧 빠질 곡" })).toBeNull(); // 덜 찬 구역
  });
});
