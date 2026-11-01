import { apiFetch } from "@/lib/api";
import type { PageResponse, TierChangeResponse } from "@/lib/api-types";

export const TIER_CHANGES_PAGE_SIZE = 30;

export const tierChangeKeys = {
  all: ["songs", "tier-changes"] as const,
};

/** 사이트 전체 서열표 변경 목록(D58). 로그인 없이 읽는 공개 경로다. */
export function fetchTierChanges(page: number, signal?: AbortSignal): Promise<PageResponse<TierChangeResponse>> {
  return apiFetch<PageResponse<TierChangeResponse>>("/songs/tier-changes", {
    query: { page, size: TIER_CHANGES_PAGE_SIZE },
    signal,
  });
}

export function recommendChanged(row: TierChangeResponse): boolean {
  return row.beforeRecommend !== row.afterRecommend;
}
