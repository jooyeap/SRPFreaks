import type { RecommendationItem, SetlistRecommendationResponse } from "@/lib/api-types";

/** 홈 `다음 목표` 아래에 보여 줄 추천 곡 수(시안 A: 3곡) */
export const HOME_PICK_COUNT = 3;

/**
 * 홈에 보여 줄 추천 곡을 고른다(D89). 서버가 준 SS 기준·S 기준 두 묶음을 합쳐서
 * 같은 티어대 근거가 있는 곡(PEER_TIER)을 반영 인원 많은 순으로 먼저, 부족하면 근거 없는 곡을 서버 순서대로 채운다.
 * READY가 아니면(신규·데이터 부족·서열표 없음) 빈 목록이다. 새로 정렬하는 기준은 인원 수뿐이고 나머지는 서버 순서를 그대로 쓴다(같은 인원이면 SS 기준이 먼저).
 */
export function pickHomeRecommendations(data: SetlistRecommendationResponse, count = HOME_PICK_COUNT): RecommendationItem[] {
  if (data.status !== "READY") return [];
  const all = [...data.ssChallenge, ...data.sFill];
  const peer = all
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.reason === "PEER_TIER" && typeof item.peerUsers === "number")
    .sort((a, b) => (b.item.peerUsers ?? 0) - (a.item.peerUsers ?? 0) || a.index - b.index)
    .map(({ item }) => item);
  const rest = all.filter((item) => !peer.includes(item));
  return [...peer, ...rest].slice(0, count);
}
