import { apiFetch } from "@/lib/api";
import type { ChartRowResponse, PageResponse, SetlistItemResponse, SetlistRecommendationResponse } from "@/lib/api-types";

/** 세트리스트 쿼리 키. 앞부분 "setlist"는 records.ts의 AFFECTED_QUERY_KEYS와 같다: 기록을 저장/수정/삭제하면 무효화되어 완료 표시가 바로 바뀐다. */
export const setlistKeys = {
  all: ["setlist"] as const,
  list: (userId: number) => ["setlist", "list", userId] as const,
  // 검색 결과에는 내 기록이 섞여 있으므로 사용자 id를 넣는다
  search: (userId: number, q: string, page: number) => ["setlist", "search", userId, q, page] as const,
  // 추천은 내 기록·세트리스트에 따라 달라진다. "setlist"로 시작해서 기록 저장·담기·빼기 때 함께 무효화된다
  recommend: (userId: number, page: number) => ["setlist", "recommend", userId, page] as const,
};

/** 서버(SetlistItem.MAX_ITEMS)와 같은 한도다. 서버도 다시 검사한다. */
export const SETLIST_LIMIT = 30;
/** 세트리스트 탭에서 한 번에 보이는 줄 수. 30곡까지 담을 수 있어 10개씩 나눈다. */
export const SETLIST_PAGE_SIZE = 10;

/** 세트리스트 전체(최대 30줄)를 한 번에 받는다. 담김 표시도 같은 응답으로 정하므로 화면 어디서든 요청은 하나다(같은 쿼리 키). */
export function fetchSetlist(signal?: AbortSignal): Promise<PageResponse<SetlistItemResponse>> {
  return apiFetch<PageResponse<SetlistItemResponse>>("/setlist", { query: { page: 0, size: SETLIST_LIMIT }, signal });
}

/** 세트리스트에 담을 채보를 찾는 검색 한 번에 받는 줄 수. */
export const SETLIST_SEARCH_PAGE_SIZE = 10;

/**
 * 곡명·아티스트로 채보를 찾는다. 곡 목록 화면과 같은 API(GET /songs/charts)를 폴더 조건 없이 검색어만 줘서 쓴다.
 * 그래서 새 백엔드 API가 필요 없고, 검색 규칙(한글·일본어·로마자, 오타 보정 전 단계)이 곡 목록과 같다.
 */
export function searchCharts(q: string, page: number, signal?: AbortSignal): Promise<PageResponse<ChartRowResponse>> {
  return apiFetch<PageResponse<ChartRowResponse>>("/songs/charts", { query: { q, page, size: SETLIST_SEARCH_PAGE_SIZE }, signal });
}

/** 추천 한 쪽에서 묶음(SS 도전 / S 채우기)마다 받는 줄 수. 서버 기본값과 같다. */
export const RECOMMEND_PAGE_SIZE = 5;

/** 내 평균 난이도 기준 추천(SS 도전 / S 채우기). 이미 담은 채보는 서버가 빼고 준다. */
export function fetchRecommendations(page: number, signal?: AbortSignal): Promise<SetlistRecommendationResponse> {
  return apiFetch<SetlistRecommendationResponse>("/setlist/recommendations", { query: { page, size: RECOMMEND_PAGE_SIZE }, signal });
}

export function addToSetlist(songDifficultyId: number): Promise<SetlistItemResponse> {
  return apiFetch<SetlistItemResponse>("/setlist", { method: "POST", body: { songDifficultyId } });
}

export function removeFromSetlist(setlistItemId: number): Promise<void> {
  return apiFetch<void>(`/setlist/${setlistItemId}`, { method: "DELETE" });
}

export function clearDoneSetlist(): Promise<{ removed: number }> {
  return apiFetch<{ removed: number }>("/setlist/done", { method: "DELETE" });
}

/** 완료한 줄 수. 화면 위쪽의 `완료 n / 전체 m`에 쓴다. */
export function doneCount(items: readonly SetlistItemResponse[]): number {
  return items.filter((item) => item.done).length;
}
