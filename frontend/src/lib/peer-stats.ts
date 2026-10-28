import { apiFetch } from "@/lib/api";

/**
 * 같은 티어 유저 기록 (D53, 서버 PeerStatsResponse와 같은 모양).
 * 서버가 같은 티어의 공개 유저들이 레이팅 목록에 넣은 채보를 집계한 값이다. 유저 식별 정보는 오지 않는다.
 */
export interface PeerChartStat {
  songDifficultyId: number;
  /** 이 채보를 레이팅에 넣은 유저 수 */
  users: number;
  /** 그 유저들의 달성률 중앙값 */
  medianRate: number;
  /** 중앙값 달성률로 쳤을 때 오르는 내 점수(0 이상). 레이팅 대상이 아닌 채보면 null */
  expectedGain: number | null;
  /** 이미 내 레이팅 목록에 들어 있는가 */
  inMyList: boolean;
  /** inMyList일 때 내 달성률 */
  myRate: number | null;
}

export interface PeerStatsResponse {
  tierName: string | null;
  /** 집계에 쓰인 공개 유저 수 ("n명 중"의 n) */
  bandUsers: number;
  /** 표시 기준(구간 인원, 채보 인원)을 넘은 채보만 온다. 기준에 못 미치면 비어 있다 */
  charts: PeerChartStat[];
}

/** 조회 키. 로그인한 사용자마다 티어가 달라 결과가 달라지므로 사용자 id를 키에 넣는다(로그아웃 뒤 다른 계정에 섞이지 않게). */
export const peerStatsKeys = {
  chart: (userId: number, chartId: number) => ["peer-stats", userId, chartId] as const,
};

/** 채보 id 여러 개의 집계를 한 번에 받는다(서버는 한 번에 최대 50개). 로그인이 필요하다. */
export function fetchPeerStats(chartIds: readonly number[], signal?: AbortSignal): Promise<PeerStatsResponse> {
  return apiFetch<PeerStatsResponse>("/peer-stats", { query: { chartIds: chartIds.join(",") }, signal });
}

/** 응답에서 채보 하나의 집계를 찾는다. 표시 기준에 못 미친 채보는 응답에 없으므로 null이다. */
export function findPeerStat(response: PeerStatsResponse, chartId: number): PeerChartStat | null {
  return response.charts.find((stat) => stat.songDifficultyId === chartId) ?? null;
}

/** `내 예상 레이팅` 줄을 보여 줄지: 오를 점수가 0보다 클 때만(0이면 보여 줄 것이 없다) */
export function hasExpectedGain(stat: PeerChartStat): boolean {
  return stat.expectedGain !== null && stat.expectedGain > 0;
}
