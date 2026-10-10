import { apiFetch } from "@/lib/api";
import type { ChartRowResponse, PageResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

/** 서열표 검색 결과 한 줄: 서열표의 채보(entry)와 그 채보가 속한 레이팅 상수 난이도(없으면 null = 미정). */
export interface TableSearchResult {
  entry: TableEntryResponse;
  tier: number | null;
}

/** 한 번에 받는 검색 결과 수. 서버가 허용하는 한 페이지의 최대값(SongChartListService.MAX_PAGE_SIZE)이다. */
export const SEARCH_PAGE_SIZE = 50;

/** 검색어 앞뒤 공백을 뺀 값. 비어 있으면 검색하지 않는다(서버는 빈 검색어를 "전체"로 보기 때문에 막아야 한다). */
export function normalizeQuery(text: string): string {
  return text.trim();
}

/**
 * 곡 검색 API(곡명·아티스트·한글/일본어/로마자 표기·별칭을 모두 찾는다)를 부른다.
 * 서열표 전용 검색 API를 따로 만들지 않고 곡 목록 검색을 그대로 쓴 뒤, 서열표에 있는 채보만 고르는 일은 화면(아래 함수)에서 한다.
 */
export function searchCharts(query: string, signal?: AbortSignal): Promise<PageResponse<ChartRowResponse>> {
  return apiFetch<PageResponse<ChartRowResponse>>("/songs/charts", {
    query: { q: normalizeQuery(query), page: 0, size: SEARCH_PAGE_SIZE },
    signal,
  });
}

/**
 * 검색된 채보 중 서열표에 있는 것만 골라 서열표 정보를 붙인다. 서버가 준 순서를 그대로 유지한다.
 * 채보(songDifficultyId)로 연결하므로 같은 곡의 다른 채보(Bass 등)가 서열표에 없으면 빠진다.
 */
export function matchTableCharts(
  groups: readonly TierGroupResponse[],
  rows: readonly ChartRowResponse[],
): TableSearchResult[] {
  const byChart = new Map<number, TableSearchResult>();
  for (const group of groups) {
    for (const entry of group.entries) {
      byChart.set(entry.songDifficultyId, { entry, tier: group.tier });
    }
  }
  const results: TableSearchResult[] = [];
  for (const row of rows) {
    const found = byChart.get(row.songDifficultyId);
    if (found) {
      results.push(found);
    }
  }
  return results;
}

/** 결과를 눌렀을 때 가는 곡 상세 주소 (서열표 정보가 함께 나오는 `from=table`). */
export function tableSearchHref(entry: Pick<TableEntryResponse, "songId" | "songDifficultyId">): string {
  return `/songs/${entry.songId}?from=table&chart=${entry.songDifficultyId}`;
}
