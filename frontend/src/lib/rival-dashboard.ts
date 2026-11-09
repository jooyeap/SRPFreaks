import { apiFetch } from "@/lib/api";
import type {
  RivalDetailFilter,
  RivalDetailRow,
  RivalDetailSort,
  RivalPatternKey,
  RivalPatternSummary,
  RivalSummaryDetailResponse,
  RivalSummaryResponse,
} from "@/lib/api-types";

/**
 * 라이벌 대시보드(D67, 6단계)의 순수 계산과 요청 함수. 승·무·패·합계·접전은 서버(5단계 API)가 센 값을 그대로 쓰고,
 * 이 파일은 그 값을 탭으로 나누고 정렬하고 막대 길이로 바꾸는 일만 한다(화면에서 다시 세지 않는다).
 * 차이는 모두 `내 점수 - 상대 점수`(표시 둘째 자리 값끼리)라서 양수가 우세, 음수가 열세다.
 */

/** 서버가 허용하는 속성 키(상세 주소의 마지막 조각). 허용 밖의 값은 서버가 400을 주므로 화면에서 먼저 거른다. */
export const PATTERN_KEYS: readonly RivalPatternKey[] = ["SINGLE", "COMPOUND", "COMPOSITE_SINGLE", "DOUBLE", "TRIPLE"];

export function isPatternKey(value: string): value is RivalPatternKey {
  return (PATTERN_KEYS as readonly string[]).includes(value);
}

/** 속성별 상세의 탭. 주소의 `?tab=`에 `strong`(우세) / `weak`(열세) / `close`(접전)로 남는다. */
export type DashTab = "strong" | "weak" | "close";
export const DASH_TABS: readonly DashTab[] = ["strong", "weak", "close"];
export const DEFAULT_TAB: DashTab = "strong";

export function parseTab(value: string | null | undefined): DashTab {
  return (DASH_TABS as readonly (string | null | undefined)[]).includes(value) ? (value as DashTab) : DEFAULT_TAB;
}

/** 차트 종류. 주소의 `?chart=`에 `bar`(막대) / `dot`(점 분포) / `radar`(레이더)로 남는다. 모르는 값은 막대로 본다. */
export type DashChart = "bar" | "dot" | "radar";
export const DASH_CHARTS: readonly DashChart[] = ["bar", "dot", "radar"];
export const DEFAULT_CHART: DashChart = "bar";

export function parseChart(value: string | null | undefined): DashChart {
  return (DASH_CHARTS as readonly (string | null | undefined)[]).includes(value) ? (value as DashChart) : DEFAULT_CHART;
}

/** 공유 곡이 이 수보다 적은 속성은 숫자가 흔들리기 쉬워 `참고용`으로 표시한다. */
export const SMALL_SAMPLE_LIMIT = 5;

export function isSmallSample(pattern: RivalPatternSummary): boolean {
  return pattern.sharedCount < SMALL_SAMPLE_LIMIT;
}

/** 합계를 센트로 바꿔 비교한다(부동소수점 찌꺼기로 +0.00/-0.00이 갈리지 않게). */
function cents(value: number): number {
  return Math.round(value * 100);
}

/**
 * 탭에 속하는 속성과 순서. 우세 = 합계가 0보다 큰 속성(합계 큰 순), 열세 = 합계가 0보다 작은 속성(합계 작은 순),
 * 접전 = 접전 곡이 있는 속성(접전 곡 많은 순). 한 속성이 우세와 접전에 함께 들어갈 수 있다. 같은 값이면 서버가 준 속성 순서를 지킨다.
 */
export function tabPatterns(patterns: readonly RivalPatternSummary[], tab: DashTab): RivalPatternSummary[] {
  const indexed = patterns.map((pattern, index) => ({ pattern, index }));
  const picked =
    tab === "strong"
      ? indexed.filter((x) => cents(x.pattern.scoreDiffSum) > 0).sort((a, b) => cents(b.pattern.scoreDiffSum) - cents(a.pattern.scoreDiffSum) || a.index - b.index)
      : tab === "weak"
        ? indexed.filter((x) => cents(x.pattern.scoreDiffSum) < 0).sort((a, b) => cents(a.pattern.scoreDiffSum) - cents(b.pattern.scoreDiffSum) || a.index - b.index)
        : indexed.filter((x) => x.pattern.closeCount > 0).sort((a, b) => b.pattern.closeCount - a.pattern.closeCount || a.index - b.index);
  return picked.map((x) => x.pattern);
}

/** 요약 카드가 가리키는 속성(탭의 맨 위). 없으면 null. */
export function topPattern(patterns: readonly RivalPatternSummary[], tab: DashTab): RivalPatternSummary | null {
  return tabPatterns(patterns, tab)[0] ?? null;
}

/**
 * 막대 한 쪽의 길이(0~100, 한쪽 절반 안의 %). 모든 속성 중 가장 큰 승·패 수를 100으로 놓고 비례하게 한다.
 * 0이면 0이고, 1 이상이면 화면의 최소 폭(38px)이 따로 받쳐 주므로 여기서는 비례값만 돌려준다.
 */
export function barPercent(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(100, (count / max) * 100);
}

/** 모든 속성 중 가장 큰 승·패 수(막대 길이의 기준). 전부 0이면 0. */
export function barMax(patterns: readonly RivalPatternSummary[]): number {
  return patterns.reduce((max, p) => Math.max(max, p.wins, p.losses), 0);
}

/** 탭 미리보기에 보이는 곡 수와 서버에 보낼 필터·정렬. 우세는 크게 앞선 순, 열세는 크게 뒤진 순, 접전은 차이(절댓값)가 작은 순. */
export const PREVIEW: Record<DashTab, { count: number; filter: RivalDetailFilter; sort: RivalDetailSort }> = {
  strong: { count: 2, filter: "WIN", sort: "DIFF_DESC" },
  weak: { count: 2, filter: "LOSE", sort: "DIFF_ASC" },
  close: { count: 3, filter: "CLOSE", sort: "CLOSE" },
};

/**
 * 속성마다 받아 온 미리보기 곡을 하나로 합쳐 탭 기준으로 다시 정렬하고 앞의 몇 곡만 남긴다.
 * 같은 값이면 채보 id 순이라 새로고침해도 순서가 흔들리지 않는다.
 */
export function mergePreview(rowsByPattern: readonly (readonly RivalDetailRow[])[], tab: DashTab): RivalDetailRow[] {
  const all = rowsByPattern.flat();
  const key = (row: RivalDetailRow) => (tab === "close" ? Math.abs(cents(row.diff)) : tab === "strong" ? -cents(row.diff) : cents(row.diff));
  return [...all].sort((a, b) => key(a) - key(b) || a.songDifficultyId - b.songDifficultyId).slice(0, PREVIEW[tab].count);
}

/** 카테고리 상세의 필터 칩. 주소의 `?filter=`에는 소문자(`all`/`lose`/`close`/`win`)로 남는다. */
export const DETAIL_FILTERS: readonly { value: RivalDetailFilter; param: "all" | "lose" | "close" | "win"; count: "all" | "lose" | "close" | "win" }[] = [
  { value: "ALL", param: "all", count: "all" },
  { value: "LOSE", param: "lose", count: "lose" },
  { value: "CLOSE", param: "close", count: "close" },
  { value: "WIN", param: "win", count: "win" },
];

export function parseDetailFilter(value: string | null | undefined): RivalDetailFilter {
  return DETAIL_FILTERS.find((f) => f.param === value)?.value ?? "ALL";
}

export function detailFilterParam(filter: RivalDetailFilter): string {
  return DETAIL_FILTERS.find((f) => f.value === filter)?.param ?? "all";
}

export const DETAIL_PAGE_SIZE = 20;

export const dashboardKeys = {
  summary: (viewerId: number, targetId: number) => ["rivals", "compare-summary", viewerId, targetId] as const,
  detail: (viewerId: number, targetId: number, key: RivalPatternKey, filter: RivalDetailFilter, sort: RivalDetailSort | null, page: number, size: number) =>
    ["rivals", "compare-summary-detail", viewerId, targetId, key, filter, sort, page, size] as const,
};

export function fetchCompareSummary(targetUserId: number, signal?: AbortSignal): Promise<RivalSummaryResponse> {
  return apiFetch<RivalSummaryResponse>(`/players/${targetUserId}/compare/summary`, { signal });
}

export function fetchCompareSummaryDetail(
  targetUserId: number,
  key: RivalPatternKey,
  options: { filter: RivalDetailFilter; sort: RivalDetailSort | null; page: number; size: number },
  signal?: AbortSignal,
): Promise<RivalSummaryDetailResponse> {
  const query: Record<string, string | number> = { filter: options.filter, page: options.page, size: options.size };
  if (options.sort) query.sort = options.sort;
  return apiFetch<RivalSummaryDetailResponse>(`/players/${targetUserId}/compare/summary/${key}`, { query, signal });
}
