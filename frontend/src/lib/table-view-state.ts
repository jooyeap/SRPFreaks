import { DEFAULT_FILTERS, PATTERN_OPTIONS, RECOMMEND_OPTIONS, type TableFilters } from "@/lib/difficulty-table";
import { DEFAULT_SORT, SORT_OPTIONS, type TableSort } from "@/lib/table-sort";

/**
 * 서열표 화면의 보기 상태(필터·정렬·평균 계산·페이지). 주소 쿼리에 두어서 곡 상세로 갔다가 뒤로 와도,
 * 새로고침해도, 링크를 공유해도 같은 화면이 나온다(곡 목록의 filtersFromParams/filtersToQuery와 같은 방식).
 * 주소는 사용자가 고칠 수 있으므로 알 수 없는 값은 버리고 기본값으로 돌린다. 기본값과 같은 항목은 주소에 쓰지 않는다.
 *
 * 주소 예: `/table?rec=상&pat=단일,복합&sort=rateDesc&zero=1&page=3` (옛 주소의 `part`는 무시)
 *  - rec: 없으면 기본(상·중), `all`이면 추천 필터 없음(전체), 아니면 쉼표로 이은 값
 *  - page: 1부터 (화면의 `1 / 5`와 같다). 내부 값은 0부터
 */
export interface TableViewState {
  filters: TableFilters;
  sort: TableSort;
  includeZero: boolean;
  /** 0부터 */
  page: number;
}

export const DEFAULT_VIEW_STATE: TableViewState = { filters: DEFAULT_FILTERS, sort: DEFAULT_SORT, includeZero: false, page: 0 };

const MAX_PAGE = 1000;

function pick(raw: string | null, options: readonly string[]): string[] {
  const wanted = new Set((raw ?? "").split(",").map((v) => v.trim()));
  return options.filter((o) => wanted.has(o)); // options 순서로 맞춘다 -> 같은 선택은 항상 같은 주소·같은 캐시 키
}

export function viewStateFromParams(params: URLSearchParams): TableViewState {
  const recRaw = params.get("rec");
  // rec가 없거나 알 수 없는 값뿐이면 기본(상·중). 전체(필터 없음)는 `all`로만 만든다
  const picked = recRaw === null || recRaw === "all" ? [] : pick(recRaw, RECOMMEND_OPTIONS);
  const recommend = recRaw === "all" ? [] : picked.length > 0 ? picked : [...DEFAULT_FILTERS.recommend];
  const sort = SORT_OPTIONS.find((o) => o.value === params.get("sort"))?.value ?? DEFAULT_SORT;
  const pageNumber = Number(params.get("page"));
  return {
    filters: {
      // 파트 필터는 2026-10-31에 서열표에서 뺐다(기준 난이도로 묶는 표라 파트 구분의 의미가 적다). 옛 주소의 part는 무시한다
      part: null,
      recommend,
      pattern: pick(params.get("pat"), PATTERN_OPTIONS),
    },
    sort,
    includeZero: params.get("zero") === "1",
    page: Number.isInteger(pageNumber) && pageNumber >= 2 ? Math.min(pageNumber, MAX_PAGE) - 1 : 0,
  };
}

/** 보기 상태 -> 주소 쿼리 문자열 (기본값뿐이면 빈 문자열). */
export function viewStateToQuery(state: TableViewState): string {
  const params = new URLSearchParams();
  const { filters } = state;
  const sameAsDefault =
    filters.recommend.length === DEFAULT_FILTERS.recommend.length && filters.recommend.every((v, i) => v === DEFAULT_FILTERS.recommend[i]);
  if (!sameAsDefault) params.set("rec", filters.recommend.length === 0 ? "all" : filters.recommend.join(","));
  if (filters.pattern.length > 0) params.set("pat", filters.pattern.join(","));
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.includeZero) params.set("zero", "1");
  if (state.page > 0) params.set("page", String(state.page + 1));
  return params.toString();
}
