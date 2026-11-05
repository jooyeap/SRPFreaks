import { DEFAULT_FILTERS, EMPTY_FILTERS, PATTERN_OPTIONS, RECOMMEND_OPTIONS, type TableFilters } from "@/lib/difficulty-table";
import { DEFAULT_SORT, SORT_OPTIONS, type TableSort } from "@/lib/table-sort";
import type { TileOrder } from "@/lib/table-tiles";

/**
 * 서열표 화면의 보기 상태(필터·정렬·평균 계산·페이지). 주소 쿼리에 두어서 곡 상세로 갔다가 뒤로 와도,
 * 새로고침해도, 링크를 공유해도 같은 화면이 나온다(곡 목록의 filtersFromParams/filtersToQuery와 같은 방식).
 * 주소는 사용자가 고칠 수 있으므로 알 수 없는 값은 버리고 기본값으로 돌린다. 기본값과 같은 항목은 주소에 쓰지 않는다.
 *
 * 주소 예: `/table?rec=상&pat=단일,복합&sort=rateDesc&zero=1&page=3` (옛 주소의 `part`는 무시)
 *  - rec: 없으면 기본(상·중), `all`이면 추천 필터 없음(전체), 아니면 쉼표로 이은 값
 *  - page: 1부터 (화면의 `1 / 5`와 같다). 내부 값은 0부터
 *  - order: 첫 화면 타일의 난이도 순서(`hard` 어려운 순 / `easy` 쉬운 순). 없으면 null = 평균이 있으면 어려운 순, 없으면 쉬운 순(table-tiles.ts defaultOrder)
 */
export interface TableViewState {
  filters: TableFilters;
  sort: TableSort;
  includeZero: boolean;
  /** 0부터 */
  page: number;
  order: TileOrder | null;
}

export const DEFAULT_VIEW_STATE: TableViewState = { filters: DEFAULT_FILTERS, sort: DEFAULT_SORT, includeZero: false, page: 0, order: null };

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
    order: params.get("order") === "hard" ? "hard" : params.get("order") === "easy" ? "easy" : null,
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
  if (state.order !== null) params.set("order", state.order);
  return params.toString();
}

/**
 * 서열표(타일 화면) -> 폴더 -> `←`로 돌아올 때 보던 자리를 되살리려고 타일을 누르는 순간 남기는 기억(2026-11-05, PR 2).
 *  - query: 그때 서열표의 보기 상태 쿼리(viewStateToQuery). `←`가 이 쿼리를 붙여 돌아가고, 폴더는 여기서 시작 필터를 가져온다
 *  - scrollY: 보던 스크롤 위치, unfolded: 먼 타일 접힘을 펼쳐 두었는지
 * 메모리 + sessionStorage(이 탭 한정). 저장소를 못 쓰면 메모리에만 남아 화면 이동으로는 유지된다. 서열표가 한 번 되살린 뒤에는 지운다(clearTableReturn).
 */
export interface TableReturn {
  query: string;
  scrollY: number;
  unfolded: boolean;
}

const RETURN_KEY = "srp.tableReturn";
let returnMemory: TableReturn | null = null;

export function rememberTableReturn(value: TableReturn): void {
  returnMemory = value;
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(value));
  } catch {
    // 저장할 수 없어도 메모리 값으로 이번 탭의 화면 이동은 유지된다
  }
}

/** 남겨 둔 기억을 읽는다(지우지 않는다). 저장소 값은 바깥에서 고칠 수 있으므로 모양을 확인하고 틀리면 없는 것으로 본다. */
export function readTableReturn(): TableReturn | null {
  if (returnMemory) return returnMemory;
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { query, scrollY, unfolded } = parsed as Record<string, unknown>;
    if (typeof query !== "string" || typeof scrollY !== "number" || !Number.isFinite(scrollY) || scrollY < 0 || typeof unfolded !== "boolean") return null;
    returnMemory = { query, scrollY, unfolded };
    return returnMemory;
  } catch {
    return null;
  }
}

export function clearTableReturn(): void {
  returnMemory = null;
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // 지울 수 없어도 화면은 정상이다
  }
}

/** `←`가 갈 서열표 주소: 떠날 때의 보기 상태가 있으면 그 쿼리를 붙인다. */
export function tableReturnHref(): string {
  const saved = readTableReturn();
  return saved && saved.query ? `/table?${saved.query}` : "/table";
}

/**
 * 폴더 화면의 시작 필터. 서열표에서 타일을 눌러 들어왔으면 그때의 필터(타일의 n/전체를 센 규칙)로 시작해서
 * 폴더 머리·이웃 버튼의 n/전체가 눌렀던 타일과 같게 한다. 곡 상세 등 다른 길로 오면(기억 없음) 필터 없이(묶음 전체) 시작한다.
 * 폴더 안에서 바꾼 필터는 그 폴더에만 적용하고 서열표로 되돌려 쓰지 않는다.
 */
export function folderStartFilters(): TableFilters {
  const saved = readTableReturn();
  return saved ? viewStateFromParams(new URLSearchParams(saved.query)).filters : EMPTY_FILTERS;
}

/** 테스트용: 기억을 비운다 */
export function resetTableReturnForTest(): void {
  clearTableReturn();
}
