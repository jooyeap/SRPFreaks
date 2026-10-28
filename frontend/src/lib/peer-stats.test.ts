import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPeerStats, findPeerStat, hasExpectedGain, type PeerChartStat, type PeerStatsResponse } from "@/lib/peer-stats";

function stat(over: Partial<PeerChartStat> = {}): PeerChartStat {
  return { songDifficultyId: 10, users: 6, medianRate: 88, expectedGain: 12.4, inMyList: false, myRate: null, ...over };
}

describe("peer-stats", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("채보 id를 쉼표로 이어서 한 번에 물어본다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ tierName: "SS 3", bandUsers: 8, charts: [] }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchPeerStats([10, 11, 12]);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/peer-stats");
    expect(decodeURIComponent(url)).toContain("chartIds=10,11,12");
  });

  it("응답에서 채보 하나의 집계를 찾고, 없으면 null", () => {
    const response: PeerStatsResponse = { tierName: "SS 3", bandUsers: 8, charts: [stat({ songDifficultyId: 10 }), stat({ songDifficultyId: 11 })] };

    expect(findPeerStat(response, 11)?.songDifficultyId).toBe(11);
    expect(findPeerStat(response, 99)).toBeNull();
  });

  it("예상 레이팅 줄은 오를 점수가 0보다 클 때만 보여 준다", () => {
    expect(hasExpectedGain(stat({ expectedGain: 12.4 }))).toBe(true);
    expect(hasExpectedGain(stat({ expectedGain: 0 }))).toBe(false);
    expect(hasExpectedGain(stat({ expectedGain: null }))).toBe(false);
  });
});
