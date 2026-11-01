import { apiFetch } from "@/lib/api";
import type { PageResponse, TierHistoryResponse } from "@/lib/api-types";

export const TIER_HISTORY_PAGE_SIZE = 10;

export const tierHistoryKeys = {
  song: (songId: number) => ["songs", songId, "tier-history"] as const,
};

export function fetchTierHistory(songId: number, page: number, signal?: AbortSignal): Promise<PageResponse<TierHistoryResponse>> {
  return apiFetch<PageResponse<TierHistoryResponse>>(`/songs/${songId}/tier-history`, {
    query: { page, size: TIER_HISTORY_PAGE_SIZE },
    signal,
  });
}

/** 한 줄에서 실제로 바뀐 항목만 골라 보여 주려고, 값이 달라졌는지 본다(둘 다 없으면 같은 값). */
export function tierChanged(row: TierHistoryResponse): boolean {
  return row.beforeTier !== row.afterTier;
}

export function patternChanged(row: TierHistoryResponse): boolean {
  return row.beforePattern !== row.afterPattern;
}

export function recommendChanged(row: TierHistoryResponse): boolean {
  return row.beforeRecommend !== row.afterRecommend;
}
