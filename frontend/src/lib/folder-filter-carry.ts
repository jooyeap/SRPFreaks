import { EMPTY_FILTERS, PATTERN_OPTIONS, RECOMMEND_OPTIONS, type TableFilters } from "@/lib/difficulty-table";
import { DEFAULT_SORT, SORT_OPTIONS, type TableSort } from "@/lib/table-sort";

/**
 * 서열표 폴더 상세에서 옆 폴더(이전/다음 난이도)로 옮길 때 보던 필터를 가져가는 규칙(D99).
 *
 * 폴더 화면은 난이도마다 새로 마운트되어서(page.tsx의 key) 화면 안의 state(필터·정렬·평균 계산)가 이동하면 사라진다.
 * 그래서 이동 주소의 쿼리에 실어 보낸다. 서열표 보기 상태(table-view-state.ts)와 같은 키 이름을 쓴다:
 *  - rec: 추천 필터(쉼표로 이은 값, 없으면 `all`). 가져갈 때는 항상 쓴다(없으면 "추천 필터 없음"이 아니라 "가져온 것 없음"이 되므로)
 *  - pat: 속성 필터(쉼표로 이은 값). 비었으면 쓰지 않는다
 *  - sort: 정렬(기본이 아닐 때만), zero: 평균 계산 `0% 포함`(켰을 때만 `1`)
 * 저장소(localStorage 등)는 쓰지 않는다: 주소 하나로 새로고침·링크 공유까지 되고, 기기에 남길 값이 없다. 토큰·개인정보는 실리지 않는다.
 * 주소는 사용자가 고칠 수 있으므로 알 수 없는 값은 버린다(허용 목록과 비교만 하고 해석하지 않는다).
 */
export interface FolderCarry {
  filters: TableFilters;
  sort: TableSort;
  includeZero: boolean;
}

/** 주소에서 이 값들이 하나라도 있으면 "옆 폴더에서 가져온 보기 상태"로 본다 */
const CARRY_KEYS = ["rec", "pat", "sort", "zero"] as const;

function pick(raw: string | null, options: readonly string[]): string[] {
  const wanted = new Set((raw ?? "").split(",").map((v) => v.trim()));
  return options.filter((o) => wanted.has(o)); // options 순서로 맞춘다 -> 같은 선택은 항상 같은 주소
}

/** 주소 쿼리에서 가져온 보기 상태를 읽는다. 가져온 값이 하나도 없으면 null(= 서열표에서 눌러 들어왔거나 다른 길). */
export function folderCarryFromParams(params: URLSearchParams): FolderCarry | null {
  if (!CARRY_KEYS.some((key) => params.has(key))) return null;
  const rec = params.get("rec");
  return {
    // 파트 필터는 서열표에서 뺐다(2026-10-31). 항상 없음
    filters: { part: null, recommend: rec === null || rec === "all" ? [] : pick(rec, RECOMMEND_OPTIONS), pattern: pick(params.get("pat"), PATTERN_OPTIONS) },
    sort: SORT_OPTIONS.find((o) => o.value === params.get("sort"))?.value ?? DEFAULT_SORT,
    includeZero: params.get("zero") === "1",
  };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * 가져갈 쿼리 문자열. 도착하는 폴더가 어차피 그 상태로 시작하면(= `start`와 같고 정렬·평균 계산이 기본) 빈 문자열이다.
 * start는 새 폴더의 시작 필터(folderStartFilters: 서열표에서 들어왔으면 그때의 필터, 아니면 없음)다.
 * 이렇게 해야 필터를 건드리지 않은 이동의 주소는 예전과 같고(`/table/folder/5.9`), 필터를 풀었거나 더 건 이동만 값을 싣는다.
 */
export function folderCarryToQuery(state: FolderCarry, start: TableFilters = EMPTY_FILTERS): string {
  const { filters } = state;
  const same =
    sameList(filters.recommend, start.recommend) && sameList(filters.pattern, start.pattern) && state.sort === DEFAULT_SORT && !state.includeZero;
  if (same) return "";
  const params = new URLSearchParams();
  params.set("rec", filters.recommend.length === 0 ? "all" : filters.recommend.join(","));
  if (filters.pattern.length > 0) params.set("pat", filters.pattern.join(","));
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.includeZero) params.set("zero", "1");
  return params.toString();
}

/** 폴더 주소에 가져갈 쿼리를 붙인다(빈 문자열이면 주소 그대로). */
export function withCarryQuery(href: string, query: string): string {
  return query === "" ? href : `${href}?${query}`;
}

/**
 * "필터를 싣고 옆 폴더로 옮겨 왔다"는 한 번짜리 표시(folder-scroll의 requestFolderScrollAdjust와 같은 방식).
 * 안내(토스트)는 옮겨 온 직후에만 띄워야 한다: 주소에 필터가 실려 있다는 사실만으로는 새로고침·링크 열기와 구분할 수 없어서 이동 직전에 표시를 남긴다.
 * 꺼낼 때(peek) 지우지 않고 화면이 자리 잡은 뒤(clear) 지운다: 개발 모드의 이중 렌더가 첫 호출에서 표시를 먹어 버리지 않게.
 */
let carried = false;

export function markFilterCarried(): void {
  carried = true;
}

export function peekFilterCarried(): boolean {
  return carried;
}

export function clearFilterCarried(): void {
  carried = false;
}

/**
 * 안내는 서열표 영역에 들어와 있는 동안 한 번만 보여 준다(2026-11-21, D99 보강).
 * 필터를 풀지 않고 계속 폴더를 넘기는 사람에게 매번 같은 안내를 띄우면 방해라서, 한 번 떴으면(초기화를 누르지 않고 무시·자동 사라짐 포함) 필터는 계속 이어 가되 안내는 더 띄우지 않는다.
 * 저장 방식은 모듈 변수(메모리)다: 폴더 화면은 난이도마다 새로 마운트되므로 화면 안의 state로는 못 기억하지만, 클라이언트 이동 중에는 모듈이 살아 있어 이 변수가 유지된다.
 * sessionStorage를 쓰지 않는 이유: 새로고침하면 다시 안내가 떠도 괜찮다고 정했고(사용자 확정), 쓰기·읽기 실패(try/catch)를 다룰 필요가 없고 기기에 남길 값도 없다. 값은 화면이 마운트된 뒤(효과 안)에만 바꾸므로 서버 렌더에는 영향이 없다.
 * 다시 켜지는 때: (1) 서열표 영역(`/table` 이하)을 벗어날 때(TableAreaGuard) (2) 안내에서 `초기화`를 눌렀을 때. 초기화로 필터를 풀었다면 이후에 필터를 새로 걸고 넘어올 때는 처음 보는 상황과 같아서 안내가 다시 도움이 된다.
 */
let noticeShown = false;

export function isFilterNoticeShown(): boolean {
  return noticeShown;
}

export function markFilterNoticeShown(): void {
  noticeShown = true;
}

export function resetFilterNoticeShown(): void {
  noticeShown = false;
}

/** 안내가 입력 없이 떠 있는 시간(ms). 입력(누르기·스크롤·키)이 있으면 이 시간부터 다시 센다 */
export const FILTER_NOTICE_IDLE_MS = 5000;

/** 입력이 계속 이어져도 안내가 떠 있을 수 있는 최대 시간(ms). 스크롤만 하는 사람에게 안내가 영영 남지 않게 한다 */
export const FILTER_NOTICE_MAX_MS = 15000;
