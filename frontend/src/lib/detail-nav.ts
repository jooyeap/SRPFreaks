import type { ChartRowResponse, TierGroupResponse } from "@/lib/api-types";
import { decidedGroups, filterTierGroup, type TableFilters } from "@/lib/difficulty-table";
import { neighborGroups } from "@/lib/folder-nav";
import { filtersFromParams, filtersToQuery, type FolderStep, type SongListFilters } from "@/lib/song-list";
import { SORT_OPTIONS, sortEntries, type TableSort } from "@/lib/table-sort";

/**
 * 곡 상세의 이전/다음 곡 이동(UX 개선 5)에 쓰는 "들어온 목록" 기억.
 *
 * 서버에는 "이 곡의 이웃"을 묻는 API가 없고 새로 만들지도 않는다. 그래서 목록 화면(서열표 폴더, 곡 목록 폴더)이
 * 곡 링크를 누르는 순간 **그 목록을 만든 조건**(정렬·필터 / 폴더·필터)만 적어 두고, 곡 상세가 이미 받아 둔 목록
 * (서열표 전체 = TanStack Query 캐시, 곡 목록 폴더 = 같은 쿼리 키의 캐시)에 그 조건을 다시 적용해서 순서를 얻는다.
 * 목록 자체를 저장하지 않으므로 기록이 바뀌어도(정렬 기준이 달라져도) 최신 값으로 계산된다.
 *
 * `current`는 지금 보고 있는 채보 id다. 이 값이 주소의 채보와 같을 때만 바를 보인다:
 * 다른 길(레이팅 카드, 공지 등)로 곡 상세에 들어오면 current가 달라서 옛 기억이 남아 있어도 바가 뜨지 않는다.
 * 바·스와이프로 옮길 때는 이동 직전에 current를 새 채보로 바꾼다.
 *
 * 메모리 + sessionStorage(이 탭 한정, 서열표 복귀 기억 lib/table-view-state.ts와 같은 방식). 저장소를 못 쓰면 메모리에만 남는다.
 */
export type DetailNavContext =
  | { source: "table"; sort: TableSort; filters: TableFilters; current: number }
  | { source: "songs"; userId: number; lo: number; step: FolderStep; filters: SongListFilters; size: number; current: number };

const KEY = "srp.detailNav";
let memory: DetailNavContext | null = null;
let loaded = false;

export function rememberDetailNav(value: DetailNavContext): void {
  memory = value;
  loaded = true;
  try {
    sessionStorage.setItem(KEY, stringifyContext(value));
  } catch {
    // 저장할 수 없어도 메모리 값으로 이번 탭의 화면 이동은 유지된다
  }
}

/**
 * 기억을 읽는다. 같은 값이면 같은 객체를 돌려준다(useSyncExternalStore가 매번 다른 값으로 보지 않게).
 * 저장소 값은 바깥에서 고칠 수 있으므로 모양을 확인하고 틀리면 없는 것으로 본다.
 */
export function readDetailNav(): DetailNavContext | null {
  if (loaded) return memory;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    memory = raw === null ? null : parseContext(JSON.parse(raw));
  } catch {
    memory = null;
  }
  return memory;
}

/** 이동 직전에 지금 보는 채보를 바꾼다. 기억이 없으면 아무것도 하지 않는다. */
export function updateDetailNavCurrent(chartId: number): void {
  const now = readDetailNav();
  if (now) rememberDetailNav({ ...now, current: chartId });
}

/** 기억을 비운다. 로그아웃 때 쓴다(이전 사용자가 보던 목록 조건이 다음 사람에게 남지 않게). 테스트도 이걸 쓴다. */
export function clearDetailNav(): void {
  memory = null;
  loaded = false;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 지울 수 없어도 화면은 정상이다
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function parseContext(raw: unknown): DetailNavContext | null {
  if (!isRecord(raw) || typeof raw.current !== "number" || !Number.isInteger(raw.current)) return null;
  if (raw.source === "table") {
    const sort = SORT_OPTIONS.find((o) => o.value === raw.sort)?.value;
    const f = raw.filters;
    if (!sort || !isRecord(f) || !isStringArray(f.recommend) || !isStringArray(f.pattern)) return null;
    const part = f.part === "GUITAR" || f.part === "BASS" ? f.part : null;
    return { source: "table", sort, filters: { part, recommend: f.recommend, pattern: f.pattern }, current: raw.current };
  }
  if (raw.source === "songs") {
    const { userId, lo, step, size, filtersQuery } = raw;
    if (typeof userId !== "number" || typeof lo !== "number" || !Number.isFinite(lo) || typeof size !== "number" || !Number.isInteger(size) || size < 1) return null;
    if (step !== "0.50" && step !== "0.05") return null;
    if (typeof filtersQuery !== "string") return null;
    return { source: "songs", userId, lo, step, size, filters: filtersFromParams(new URLSearchParams(filtersQuery)), current: raw.current };
  }
  return null;
}

// 곡 목록 쪽 filters는 객체 그대로 저장하면 알 수 없는 모양이 들어올 수 있어서, 주소 쿼리와 같은 문자열(filtersQuery)로 저장하고 읽을 때 filtersFromParams로 검증한다.
function stringifyContext(value: DetailNavContext): string {
  if (value.source === "songs") {
    const { filters, ...rest } = value;
    return JSON.stringify({ ...rest, filtersQuery: filtersToQuery(filters) });
  }
  return JSON.stringify(value);
}

/** 곡 링크 주소에서 채보 id를 꺼낸다: `/songs/{곡}?from=…&chart={채보}`. 곡 상세 링크가 아니거나 채보가 없으면 null. */
export function chartIdOfDetailHref(href: string | null): number | null {
  const match = href === null ? null : /^\/songs\/\d+\?(?:[^#]*&)?chart=(\d+)(?:&|#|$)/.exec(href);
  return match ? Number(match[1]) : null;
}

/** 클릭한 요소가 곡 상세 링크(안의 글자·재킷 포함)면 그 채보 id. 목록 영역의 onClick 한 곳에서 쓴다. */
export function chartIdOfDetailLink(target: EventTarget | null): number | null {
  const anchor = target instanceof Element ? target.closest("a") : null;
  return anchor ? chartIdOfDetailHref(anchor.getAttribute("href")) : null;
}

/** 바가 한 칸 옮겨 갈 곳 */
export type NavStep =
  /** 목록에 이미 있는 채보로 간다. tier는 서열표에서 다른 묶음으로 넘어갈 때만 있다(그 묶음의 기준 난이도 = 버튼 이름 `다음 묶음 5.4`) */
  | { kind: "go"; songId: number; chartId: number; tier?: number }
  /** 곡 목록에서 지금까지 받은 끝이지만 서버에 더 있다: 다음 페이지를 받은 뒤 그 첫 채보로 간다 */
  | { kind: "more" };

export interface NavView {
  /** 1부터 */
  position: number;
  total: number;
  prev: NavStep | null;
  next: NavStep | null;
  /** 서열표: 지금 묶음의 기준 난이도(가운데 `서열표 5.3`). 곡 목록은 null */
  tier: number | null;
}

/**
 * 서열표에서 들어온 경우의 이웃 계산. 폴더 화면과 같은 규칙으로 목록을 다시 만든다:
 * 미정 묶음 제외 → 필터 적용(filterTierGroup) → 곡이 있는 묶음만 → 묶음 안은 정렬(sortEntries).
 * 묶음 처음/끝에서는 바로 옆 묶음(위 = 다음 묶음, 아래 = 이전 묶음)의 첫/마지막 채보로 넘어간다(폴더 이웃 계산 neighborGroups 재사용).
 * 지금 채보가 목록에 없으면(필터에서 빠졌거나 미정 묶음) null = 바 없음.
 */
export function tableNavView(allGroups: readonly TierGroupResponse[], ctx: Extract<DetailNavContext, { source: "table" }>, chartId: number): NavView | null {
  const groups = decidedGroups(allGroups)
    .map((g) => filterTierGroup(g, ctx.filters))
    .filter((g) => g.total > 0);
  const group = groups.find((g) => g.entries.some((e) => e.songDifficultyId === chartId));
  if (!group || group.tier === null) return null;
  const entries = sortEntries(group.entries, ctx.sort);
  const index = entries.findIndex((e) => e.songDifficultyId === chartId);
  const { higher, lower } = neighborGroups(groups, group.tier);
  const step = (g: TierGroupResponse, pick: "first" | "last"): NavStep | null => {
    const sorted = sortEntries(g.entries, ctx.sort);
    const e = pick === "first" ? sorted[0] : sorted[sorted.length - 1];
    return e && g.tier !== null ? { kind: "go", songId: e.songId, chartId: e.songDifficultyId, tier: g.tier } : null;
  };
  const inside = (i: number): NavStep => ({ kind: "go", songId: entries[i].songId, chartId: entries[i].songDifficultyId });
  return {
    position: index + 1,
    total: entries.length,
    tier: group.tier,
    prev: index > 0 ? inside(index - 1) : lower ? step(lower, "last") : null,
    next: index < entries.length - 1 ? inside(index + 1) : higher ? step(higher, "first") : null,
  };
}

/**
 * 곡 목록에서 들어온 경우의 이웃 계산. rows는 그 폴더에서 지금까지 받은 채보(받은 순서 = 목록 순서), total은 서버가 준 폴더 전체 개수다.
 * 받은 끝에서 더 있으면(hasMore) 다음은 `more`(다음 페이지를 받아서 간다)다. 지금 채보가 받은 목록에 없으면 null.
 */
export function songsNavView(rows: readonly ChartRowResponse[], total: number, hasMore: boolean, chartId: number): NavView | null {
  const index = rows.findIndex((r) => r.songDifficultyId === chartId);
  if (index < 0) return null;
  const at = (i: number): NavStep => ({ kind: "go", songId: rows[i].songId, chartId: rows[i].songDifficultyId });
  return {
    position: index + 1,
    total: Math.max(total, rows.length),
    tier: null,
    prev: index > 0 ? at(index - 1) : null,
    next: index < rows.length - 1 ? at(index + 1) : hasMore ? { kind: "more" } : null,
  };
}

/** 테스트용 이름(예전 호출처 유지) */
export const resetDetailNavForTest = clearDetailNav;
