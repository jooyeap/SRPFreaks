import { apiFetch } from "@/lib/api";
import type { PageResponse, TierChangeResponse } from "@/lib/api-types";

export const TIER_CHANGES_PAGE_SIZE = 30;

export const tierChangeKeys = {
  all: ["songs", "tier-changes"] as const,
  recent: ["songs", "tier-changes", "recent"] as const,
};

/** 서열표 묶음 머리의 `최근 변경 n` 칩이 세는 기간(2026-11-01). 이보다 오래된 변경은 세지 않는다 */
export const RECENT_CHANGE_DAYS = 7;
/** 칩을 셀 때 한 번에 받는 변경 수(서버 상한 100). 7일 안에 이보다 많이 바뀌는 일은 드물어 첫 페이지만 본다 */
export const RECENT_CHANGES_FETCH_SIZE = 100;

/** 이 기기에서 `서열표 변경` 탭을 마지막으로 본 시각(ISO). 브라우저에만 두고 서버에는 보내지 않는다 */
const SEEN_KEY = "srp.tierChangesSeenAt";

export function readTierChangesSeenAt(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null; // 사생활 보호 모드 등에서 저장소를 못 쓰면 "본 적 없음"으로 본다
  }
}

export function markTierChangesSeen(now: Date = new Date()): void {
  try {
    window.localStorage.setItem(SEEN_KEY, now.toISOString());
  } catch {
    // 저장하지 못해도 화면은 그대로 쓸 수 있다(칩이 7일 동안 남을 뿐)
  }
}

/**
 * 묶음(기준 난이도, `5.6` 같은 글자)별 최근 변경 수. 세는 것은 "최근 7일 안" 이면서 "이 기기에서 변경 탭을 본 뒤"에 생긴 변경이다
 * (탭을 확인하면 칩이 사라지고, 확인하지 않아도 7일이 지나면 사라진다). 묶음은 바뀐 뒤의 기준 난이도로 정한다.
 * 기준 난이도가 없는(미정) 변경은 묶음 칩에 세지 않는다.
 */
export function countRecentByTier(
  rows: readonly TierChangeResponse[],
  now: Date,
  seenAt: string | null,
): Map<string, number> {
  const weekAgo = now.getTime() - RECENT_CHANGE_DAYS * 24 * 60 * 60 * 1000;
  const seen = seenAt ? Date.parse(seenAt) : Number.NaN;
  const cutoff = Number.isNaN(seen) ? weekAgo : Math.max(weekAgo, seen);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.afterTier === null || Date.parse(row.changedAt) <= cutoff) {
      continue;
    }
    const key = row.afterTier.toFixed(1);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** 사이트 전체 서열표 변경 목록(D58). 로그인 없이 읽는 공개 경로다. */
export function fetchTierChanges(
  page: number,
  signal?: AbortSignal,
  size: number = TIER_CHANGES_PAGE_SIZE,
): Promise<PageResponse<TierChangeResponse>> {
  return apiFetch<PageResponse<TierChangeResponse>>("/songs/tier-changes", {
    query: { page, size },
    signal,
  });
}

export function recommendChanged(row: TierChangeResponse): boolean {
  return row.beforeRecommend !== row.afterRecommend;
}

/** 같은 날 같은 채보의 여러 변경을 한 줄로 묶은 것(2026-11-02). 각 값은 그날 바뀐 순서대로의 흐름이다(연속으로 같은 값은 한 번만). */
export interface MergedTierChange {
  latest: TierChangeResponse;
  /** 그날 서열표에 새로 추가된 채보인지 */
  created: boolean;
  tiers: (number | null)[];
  patterns: (string | null)[];
  recommends: (string | null)[];
}

function pushDistinct<T>(chain: T[], value: T): void {
  if (chain.length === 0 || chain[chain.length - 1] !== value) {
    chain.push(value);
  }
}

/**
 * 하루치 변경(최신순)을 채보별로 한 줄로 묶는다. 줄 순서는 그 채보의 마지막 변경 시각(최신순)이다.
 * 예: 추가(5.1) → 5.1→5.2 → 5.2→5.1 이면 `추가, 기준 난이도 5.1 → 5.2 → 5.1` 한 줄.
 */
export function mergeSameChart(rows: readonly TierChangeResponse[]): MergedTierChange[] {
  const byChart = new Map<number, TierChangeResponse[]>();
  const order: number[] = [];
  for (const row of rows) {
    const list = byChart.get(row.songDifficultyId);
    if (list) {
      list.push(row);
    } else {
      byChart.set(row.songDifficultyId, [row]);
      order.push(row.songDifficultyId);
    }
  }
  return order.map((id) => {
    const newestFirst = byChart.get(id) ?? [];
    const oldestFirst = [...newestFirst].reverse();
    const first = oldestFirst[0];
    const tiers: (number | null)[] = [];
    const patterns: (string | null)[] = [];
    const recommends: (string | null)[] = [];
    if (!first.created) {
      tiers.push(first.beforeTier);
      patterns.push(first.beforePattern);
      recommends.push(first.beforeRecommend);
    }
    for (const row of oldestFirst) {
      pushDistinct(tiers, row.afterTier);
      pushDistinct(patterns, row.afterPattern);
      pushDistinct(recommends, row.afterRecommend);
    }
    return { latest: newestFirst[0], created: oldestFirst.some((row) => row.created), tiers, patterns, recommends };
  });
}
