import { apiFetch } from "@/lib/api";
import type { DifficultyTableResponse, PageResponse, TierGroupResponse } from "@/lib/api-types";
import type { InstrumentPart } from "@/lib/types";

/**
 * 레이팅/서열표 화면이 쓰는 서열표를 고른다: 상태가 ACTIVE이고 노트 옵션이 SRN+인 표 중 id가 가장 작은 것.
 * 서버(SkillService)가 레이팅에 쓰는 표를 고르는 규칙과 같아서, 서열표 화면과 레이팅 화면이 같은 표를 본다.
 * 해당하는 표가 없으면 null.
 */
export function pickRatingTable(tables: readonly DifficultyTableResponse[]): DifficultyTableResponse | null {
  const candidates = tables
    .filter((t) => t.status === "ACTIVE" && t.noteOption === "SUPER_RANDOM_PLUS")
    .sort((a, b) => a.id - b.id);
  return candidates[0] ?? null;
}

/** 묶음 평균. "0% 포함"이면 기록 없는 채보를 0%로 넣은 값, 아니면 기록 있는 채보만의 값(기록이 없으면 null). */
export function groupAverage(group: TierGroupResponse, includeZero: boolean): number | null {
  return includeZero ? group.averageWithZero : group.averageRecorded;
}

/** 서열표 필터. 값이 null이면 "전체". recommend/pattern은 서버가 쓰는 한글 값 그대로다. */
export interface TableFilters {
  part: InstrumentPart | null;
  recommend: string | null;
  pattern: string | null;
}

export const EMPTY_FILTERS: TableFilters = { part: null, recommend: null, pattern: null };

export const RECOMMEND_OPTIONS = ["상", "중", "하"] as const;
export const PATTERN_OPTIONS = ["단일", "복합", "이중", "삼중"] as const;

/** TanStack Query 키. 필터나 페이지가 바뀌면 키가 달라져서 새로 가져오고, 같으면 캐시를 쓴다. */
export const tableKeys = {
  list: ["difficulty-tables"] as const,
  entries: (tableId: number, filters: TableFilters, page: number) =>
    ["difficulty-tables", tableId, "entries", filters, page] as const,
};

export function fetchDifficultyTables(signal?: AbortSignal): Promise<DifficultyTableResponse[]> {
  return apiFetch<DifficultyTableResponse[]>("/difficulty-tables", { signal });
}

/** 서열표 한 페이지(기준 난이도 묶음 단위). mine=true로 본인 기록을 함께 받는다. */
export function fetchTableEntries(
  tableId: number,
  filters: TableFilters,
  page: number,
  signal?: AbortSignal,
): Promise<PageResponse<TierGroupResponse>> {
  return apiFetch<PageResponse<TierGroupResponse>>(`/difficulty-tables/${tableId}/entries`, {
    query: { part: filters.part, recommend: filters.recommend, pattern: filters.pattern, mine: true, page },
    signal,
  });
}
