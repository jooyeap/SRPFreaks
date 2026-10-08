import { apiFetch } from "@/lib/api";
import type { DifficultyTableResponse, PageResponse, TierGroupResponse } from "@/lib/api-types";
import { formatTier } from "@/lib/format";
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

/**
 * 묶음(기준 난이도) 하나를 가리키는 주소 조각. `/table/folder/5.8`, 기준 난이도가 없는 묶음은 `/table/folder/undecided`.
 * 소수 첫째 자리로 맞춰서(5.8 → "5.8", 6 → "6.0") 서버 값(0.1 단위)과 주소 값을 문자열로 비교한다.
 * 숫자로 바꿔 비교하면 부동소수 오차가 낄 수 있어 문자열을 기준으로 삼는다.
 */
export function tierParam(tier: number | null): string {
  return tier === null ? "undecided" : tier.toFixed(1);
}

/** 서열표 전체에서 주소 조각에 해당하는 묶음을 찾는다. 없으면 null (잘못된 주소 포함). */
export function findGroupByParam(groups: readonly TierGroupResponse[], param: string): TierGroupResponse | null {
  return groups.find((g) => tierParam(g.tier) === param) ?? null;
}

/** 묶음 페이지 주소. */
export function folderHref(tier: number | null): string {
  return `/table/folder/${tierParam(tier)}`;
}

/** 대시보드의 서열표 진행도. 서버가 준 묶음별 개수를 합치기만 한다(채보를 화면에서 다시 세지 않는다). */
export interface TableProgress {
  total: number;
  recorded: number;
  exc: number;
  fc: number;
  ss: number;
  s: number;
  belowS: number;
  /** 묶음별 (서열표 순서 그대로: 높은 기준 난이도 먼저, 미정 맨 뒤). 6.5 이상은 한 줄로 합친다 */
  groups: ProgressGroup[];
}

/** 진행도 카드의 한 줄. 6.5 이상은 숫자를 더한 한 줄(`6.5 이상`)이고, 그 밖의 묶음은 기준 난이도 하나에 한 줄이다. */
export interface ProgressGroup {
  /** 줄을 구분하는 키 */
  key: string;
  /** 화면에 보이는 이름: `5.8`, `미정`, `6.5 이상` */
  label: string;
  /** 눌렀을 때 이동할 주소. 합친 줄은 서열표 맨 위(높은 난이도부터 시작)로 간다 */
  href: string;
  total: number;
  recorded: number;
  exc: number;
  fc: number;
  ss: number;
  s: number;
  belowS: number;
}

/** 이 값 이상의 기준 난이도 묶음은 진행도 카드에서 한 줄(`6.5 이상`)로 합친다. 높은 난이도는 곡 수가 적어 줄이 길어지기만 해서다. */
export const MERGE_FROM_TIER = 6.5;

export function tableProgress(groups: readonly TierGroupResponse[]): TableProgress {
  const sum = (pick: (g: TierGroupResponse) => number) => groups.reduce((acc, g) => acc + pick(g), 0);
  return {
    total: sum((g) => g.total),
    recorded: sum((g) => g.recorded),
    exc: sum((g) => g.exc),
    fc: sum((g) => g.fc),
    ss: sum((g) => g.ss),
    s: sum((g) => g.s),
    belowS: sum((g) => g.belowS),
    groups: progressGroups(groups),
  };
}

/**
 * 묶음별 줄을 만든다. 기준 난이도가 MERGE_FROM_TIER 이상인 묶음은 숫자를 더해서 한 줄로 합치고(맨 위에 둔다),
 * 나머지는 서열표 순서 그대로 둔다. 합친 줄이 하나뿐이어도 `6.5 이상`으로 보여 준다(기준이 일정해야 헷갈리지 않는다).
 * 부동소수 비교를 피하려고 0.1 단위 정수로 바꿔서 비교한다.
 */
function progressGroups(groups: readonly TierGroupResponse[]): ProgressGroup[] {
  const mergeFrom = Math.round(MERGE_FROM_TIER * 10);
  const high = groups.filter((g) => g.tier !== null && Math.round(g.tier * 10) >= mergeFrom);
  const result: ProgressGroup[] = [];
  if (high.length > 0) {
    const sum = (pick: (g: TierGroupResponse) => number) => high.reduce((acc, g) => acc + pick(g), 0);
    result.push({
      key: "merged-high",
      label: `${formatTier(MERGE_FROM_TIER)} 이상`,
      href: "/table",
      total: sum((g) => g.total),
      recorded: sum((g) => g.recorded),
      exc: sum((g) => g.exc),
      fc: sum((g) => g.fc),
      ss: sum((g) => g.ss),
      s: sum((g) => g.s),
      belowS: sum((g) => g.belowS),
    });
  }
  for (const g of groups) {
    if (high.includes(g)) {
      continue;
    }
    result.push({
      key: g.tier === null ? "undecided" : tierParam(g.tier),
      label: formatTier(g.tier),
      href: folderHref(g.tier),
      total: g.total,
      recorded: g.recorded,
      exc: g.exc,
      fc: g.fc,
      ss: g.ss,
      s: g.s,
      belowS: g.belowS,
    });
  }
  return result;
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
  // 내 기록이 들어 있으므로 사용자 id를 키에 넣어, 계정이 바뀌어도 이전 사용자의 캐시를 보지 않게 한다.
  entries: (userId: number, tableId: number, filters: TableFilters, page: number) =>
    ["difficulty-tables", tableId, "entries", userId, filters, page] as const,
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

/** 서열표 전체(모든 묶음)를 담은 쿼리 키. "difficulty-tables"로 시작하므로 기록을 바꾸면 함께 무효화된다. */
export const allGroupsKey = (userId: number, tableId: number) =>
  ["difficulty-tables", tableId, "all", userId] as const;

/** 서버가 한 번에 주는 묶음 수의 최대값(DifficultyTableViewService.MAX_PAGE_SIZE). */
const GROUPS_PER_REQUEST = 20;
/** 서버가 이상한 totalPages를 줘도 무한히 돌지 않게 하는 안전장치 (실제 묶음은 약 21개라 2번이면 끝난다). */
const MAX_PAGES = 10;

/**
 * 서열표의 모든 묶음을 이어 받아 하나의 배열로 합친다 (곡 상세가 곡 하나의 서열표 정보를 찾는 데 쓴다).
 * 서버는 묶음 단위로 페이지를 나누므로(채보 669개를 한 번에 주지 않는다) 마지막 페이지까지 순서대로 요청한다.
 * 묶음 순서(높은 기준 난이도 먼저, 미정 맨 뒤)와 묶음 안 순서(레벨 높은 순)는 서버가 준 그대로 유지한다.
 */
export async function fetchAllTierGroups(tableId: number, signal?: AbortSignal): Promise<TierGroupResponse[]> {
  const groups: TierGroupResponse[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await apiFetch<PageResponse<TierGroupResponse>>(`/difficulty-tables/${tableId}/entries`, {
      query: { mine: true, page, size: GROUPS_PER_REQUEST },
      signal,
    });
    groups.push(...result.content);
    if (page + 1 >= result.totalPages) {
      break;
    }
  }
  return groups;
}
