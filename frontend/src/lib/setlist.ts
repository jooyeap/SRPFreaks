import { apiFetch } from "@/lib/api";
import type { PageResponse, SetlistItemResponse } from "@/lib/api-types";

/** 세트리스트 쿼리 키. 앞부분 "setlist"는 records.ts의 AFFECTED_QUERY_KEYS와 같다: 기록을 저장/수정/삭제하면 무효화되어 완료 표시가 바로 바뀐다. */
export const setlistKeys = {
  all: ["setlist"] as const,
  list: (userId: number) => ["setlist", "list", userId] as const,
};

/** 서버(SetlistItem.MAX_ITEMS)와 같은 한도다. 서버도 다시 검사한다. */
export const SETLIST_LIMIT = 30;
/** 세트리스트 탭에서 한 번에 보이는 줄 수. 30곡까지 담을 수 있어 10개씩 나눈다. */
export const SETLIST_PAGE_SIZE = 10;

/** 세트리스트 전체(최대 30줄)를 한 번에 받는다. 담김 표시도 같은 응답으로 정하므로 화면 어디서든 요청은 하나다(같은 쿼리 키). */
export function fetchSetlist(signal?: AbortSignal): Promise<PageResponse<SetlistItemResponse>> {
  return apiFetch<PageResponse<SetlistItemResponse>>("/setlist", { query: { page: 0, size: SETLIST_LIMIT }, signal });
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
