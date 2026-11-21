import { describe, expect, it } from "vitest";
import type { RecommendationItem, SetlistRecommendationResponse } from "@/lib/api-types";
import { pickHomeRecommendations } from "@/lib/peer-picks";

function rec(id: number, over: Partial<RecommendationItem> = {}): RecommendationItem {
  return { songDifficultyId: id, songId: 300 + id, title: `추천곡${id}`, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 6.2, pattern: "단일", mine: null, ...over };
}
function resp(over: Partial<SetlistRecommendationResponse>): SetlistRecommendationResponse {
  return {
    status: "READY", baseTier: 6.2, ssMin: -0.6, ssMax: -0.1, sMin: -0.1, sMax: 0.4, customRange: false, ratedSingle: 15, ratedOther: 25,
    requiredSingle: 5, requiredOther: 9, ssChallenge: [], sFill: [], ssPage: 0, sPage: 0, size: 5, ssTotalPages: 1, sTotalPages: 1, ...over,
  };
}
const peer = (id: number, n: number) => rec(id, { reason: "PEER_TIER", peerUsers: n });
const near = (id: number) => rec(id, { reason: "NEAR_AVERAGE", peerUsers: null });

describe("홈 추천 곡 고르기 (D89)", () => {
  it("근거 있는 곡을 인원 많은 순으로 먼저, 모자라면 근거 없는 곡을 서버 순서대로 채워 3곡", () => {
    const data = resp({ ssChallenge: [near(1), peer(2, 7)], sFill: [peer(3, 12), near(4)] });
    expect(pickHomeRecommendations(data).map((i) => i.songDifficultyId)).toEqual([3, 2, 1]);
  });

  it("인원이 같으면 서버 순서(SS 기준이 먼저)를 유지한다", () => {
    const data = resp({ ssChallenge: [peer(1, 5)], sFill: [peer(2, 5)] });
    expect(pickHomeRecommendations(data).map((i) => i.songDifficultyId)).toEqual([1, 2]);
  });

  it("근거가 하나도 없으면 서버 순서 그대로", () => {
    const data = resp({ ssChallenge: [near(1), near(2)], sFill: [near(3), near(4)] });
    expect(pickHomeRecommendations(data).map((i) => i.songDifficultyId)).toEqual([1, 2, 3]);
  });

  it("READY가 아니면 비어 있다", () => {
    expect(pickHomeRecommendations(resp({ status: "STARTER", sFill: [rec(1)] }))).toEqual([]);
    expect(pickHomeRecommendations(resp({ status: "INSUFFICIENT" }))).toEqual([]);
  });
});
