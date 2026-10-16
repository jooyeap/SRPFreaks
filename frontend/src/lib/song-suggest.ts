import { apiFetch } from "@/lib/api";
import type { SongSuggestionResponse } from "@/lib/api-types";

/** 서버(SongSuggestService)가 받는 최소 글자 수. 이보다 짧으면 요청하지 않는다. */
export const SUGGEST_MIN_LENGTH = 2;

export const songSuggestKeys = {
  query: (query: string) => ["songs", "suggest", query] as const,
};

/** 오타 보정 후보를 받는다. 검색 결과가 비었을 때만 부른다. */
export function fetchSongSuggestions(query: string, signal?: AbortSignal): Promise<SongSuggestionResponse[]> {
  return apiFetch<SongSuggestionResponse[]>("/songs/suggest", { query: { q: query.trim() }, signal });
}

/** 후보를 요청할 만한 검색어인가 (공백만이거나 너무 짧으면 아니다). */
export function canSuggest(query: string): boolean {
  return query.trim().length >= SUGGEST_MIN_LENGTH;
}
