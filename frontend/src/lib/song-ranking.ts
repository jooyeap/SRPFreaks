import { apiFetch } from "@/lib/api";
import { formatRate } from "@/lib/format";
import type { AchievementStage } from "@/lib/types";

/**
 * 곡별 순위 (D74, 서버 SongRankingResponse와 같은 모양). 채보 하나의 공개 유저 순위다.
 * 서버가 공개(profile_public) + ACTIVE 유저만으로 계산해서 주고, 화면은 받은 값만 보인다.
 * 이메일·역할·Google ID·티어·총점은 오지 않는다. userId는 닉네임을 유저 상세로 연결할 때만 쓴다(D74 (6)).
 */
export interface SongRankingItem {
  rank: number;
  userId: number;
  nickname: string;
  achievementRate: number;
  stage: AchievementStage;
  /** 이 줄이 나인가 */
  isMe: boolean;
}

/**
 * 내 순위. 세 가지다:
 * - null: 공개 유저인데 이 채보에 기록이 없다
 * - { inRanking: false }: 내가 공개가 아니다(기록이 있어도 순위·달성률은 오지 않는다)
 * - { inRanking: true, ... }: 순위에 있다
 */
export interface SongRankingMe {
  inRanking: boolean;
  rank?: number | null;
  achievementRate?: number | null;
  stage?: AchievementStage | null;
}

export interface SongRankingResponse {
  songDifficultyId: number;
  /** 이 채보에 기록이 있는 공개 유저 수 */
  players: number;
  page: number;
  size: number;
  totalPages: number;
  me: SongRankingMe | null;
  items: SongRankingItem[];
}

/** 요약 카드는 상위 3줄만 부른다(같은 API를 size=3으로, D74 API 절). */
export const SUMMARY_SIZE = 3;

/**
 * 조회 키. 앞부분이 "skill"이라 기록을 저장/수정/삭제하면(records.ts의 AFFECTED_QUERY_KEYS의 ["skill"]) 같이 무효화되어 순위가 바로 갱신된다.
 * 사용자 id를 넣는 이유: 로그아웃 뒤 다른 계정에 이전 사용자의 응답(내 순위)이 섞이지 않게 하려는 것이다.
 */
export const songRankingKeys = {
  summary: (userId: number, chartId: number) => ["skill", userId, "song-ranking", chartId, SUMMARY_SIZE] as const,
};

/** 한 페이지를 받는다. 로그인이 필요하다(서버가 비로그인은 401). */
export function fetchSongRanking(chartId: number, page: number, size: number, signal?: AbortSignal): Promise<SongRankingResponse> {
  return apiFetch<SongRankingResponse>(`/difficulties/${chartId}/ranking`, { query: { page, size }, signal });
}

/** 달성률 표시: 100.00은 `MAX`(그대로), 그 외는 둘째 자리까지 + `%`. */
export function rankingRateText(rate: number): string {
  const text = formatRate(rate);
  return text === "MAX" ? text : `${text}%`;
}

/** 내 순위가 있는가(공개이고 이 채보에 기록이 있어 순위가 정해진 상태). */
export function myRankOf(me: SongRankingMe | null): { rank: number; rate: number; stage: AchievementStage | null } | null {
  if (!me || !me.inRanking || me.rank == null || me.achievementRate == null) {
    return null;
  }
  return { rank: me.rank, rate: me.achievementRate, stage: me.stage ?? null };
}
