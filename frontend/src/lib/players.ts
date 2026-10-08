import { apiFetch } from "@/lib/api";
import type { PageResponse, PlayerDetailResponse, PlayerSummaryResponse } from "@/lib/api-types";

/**
 * 유저 목록·상세 쿼리 키 (D26). 앞부분 "players"로 한꺼번에 무효화할 수 있다(내 공개 설정을 바꾸면 목록이 달라진다).
 * 보는 사람(viewerId)을 키에 넣는 이유: 계정이 바뀌어도 이전 계정이 받은 캐시가 보이지 않게 하려는 것이다(다른 화면과 같은 규칙).
 */
export const playerKeys = {
  all: ["players"] as const,
  list: (viewerId: number, page: number, size: number) => ["players", "list", viewerId, page, size] as const,
  detail: (viewerId: number, playerId: number) => ["players", "detail", viewerId, playerId] as const,
};

export const PLAYERS_PAGE_SIZE = 20;

export function fetchPlayers(page: number, size: number, signal?: AbortSignal): Promise<PageResponse<PlayerSummaryResponse>> {
  return apiFetch<PageResponse<PlayerSummaryResponse>>("/players", { query: { page, size }, signal });
}

/** 공개한 유저의 상세. 비공개·차단·없는 유저는 서버가 모두 404로 답한다. */
export function fetchPlayer(playerId: number, signal?: AbortSignal): Promise<PlayerDetailResponse> {
  return apiFetch<PlayerDetailResponse>(`/players/${playerId}`, { signal });
}
