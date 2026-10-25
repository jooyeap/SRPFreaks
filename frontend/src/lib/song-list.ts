import { apiFetch } from "@/lib/api";
import type { ChartFolderListResponse, ChartFolderResponse, ChartRowResponse, PageResponse } from "@/lib/api-types";
import { formatLevel } from "@/lib/format";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/** 곡 목록 쿼리 키. 앞부분 "song-list"로 기록 저장 후 한꺼번에 무효화한다(AFFECTED_QUERY_KEYS). 내 기록이 섞이므로 사용자 id를 넣는다. */
export const songListKeys = {
  // 필터가 걸리면 폴더 구성이 달라지므로 조건도 키에 넣는다. 필터 없음(EMPTY_SONG_FILTERS)이 전체 현황용 키다
  folders: (userId: number, filters: SongListFilters = EMPTY_SONG_FILTERS) => ["song-list", "folders", userId, filters] as const,
  // 같은 시작값(9.50)이 큰 폴더와 하위 폴더 둘 다 있으므로 단위(step)도 키에 넣는다
  // 한 번에 이어 받는 개수(size)도 키에 넣는다: 개수를 바꾸면 이전 개수로 받은 쪽이 섞이지 않고 새로 받는다
  folder: (userId: number, lo: number, step: FolderStep, filters: SongListFilters = EMPTY_SONG_FILTERS, size: number = CHARTS_PAGE_SIZE) =>
    ["song-list", "folder", userId, step, lo, filters, size] as const,
};

/** 폴더 단위: 큰 폴더는 0.5, 그 안의 하위 폴더는 0.05. 서버의 `folderStep` 파라미터 값이다. */
export type FolderStep = "0.50" | "0.05";

/** 한 번에 이어 받는 채보 수 (`더 보기` 한 번). 서버 기본값과 같다. */
export const CHARTS_PAGE_SIZE = 20;

/** 검색·필터 조건. 값이 비어 있으면 "전체". */
export interface SongListFilters {
  q: string;
  part: InstrumentPart | null;
  difficulties: DifficultyType[];
  version: string | null;
}

export const EMPTY_SONG_FILTERS: SongListFilters = { q: "", part: null, difficulties: [], version: null };

/** 검색하거나 필터를 쓰는 중인가. 폴더는 그대로 두고 폴더 안 채보만 걸러진다 (DESIGN-UI 9장). */
export function isFiltering(filters: SongListFilters): boolean {
  return filters.q.trim() !== "" || filters.part !== null || filters.difficulties.length > 0 || filters.version !== null;
}

/** 적용 중인 필터 개수(검색어는 세지 않는다). 모바일 `필터 3` 표시에 쓴다. */
export function activeFilterCount(filters: SongListFilters): number {
  return (filters.part ? 1 : 0) + filters.difficulties.length + (filters.version ? 1 : 0);
}

// 주소 쿼리 (`/songs?q=…&part=G&diff=MAS,EXT&ver=…`). 짧은 코드를 쓰고, 알 수 없는 값은 버린다(주소는 사용자가 고칠 수 있다).
const PART_CODES: Record<string, InstrumentPart> = { G: "GUITAR", B: "BASS" };
const DIFF_CODES: Record<string, DifficultyType> = { ADV: "ADVANCED", EXT: "EXTREME", MAS: "MASTER" };
const DIFF_ORDER: DifficultyType[] = ["ADVANCED", "EXTREME", "MASTER"];
const MAX_TEXT = 100;

export function filtersFromParams(params: URLSearchParams): SongListFilters {
  const diffs = new Set<DifficultyType>();
  for (const code of (params.get("diff") ?? "").split(",")) {
    const d = DIFF_CODES[code.trim()];
    if (d) diffs.add(d);
  }
  const version = (params.get("ver") ?? "").trim();
  return {
    q: (params.get("q") ?? "").slice(0, MAX_TEXT),
    part: PART_CODES[params.get("part") ?? ""] ?? null,
    difficulties: DIFF_ORDER.filter((d) => diffs.has(d)),
    version: version === "" ? null : version.slice(0, MAX_TEXT),
  };
}

/** 조건을 주소 쿼리 문자열로 (비어 있으면 빈 문자열 -> 폴더 목록). */
export function filtersToQuery(filters: SongListFilters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set("q", q);
  if (filters.part) params.set("part", filters.part === "GUITAR" ? "G" : "B");
  if (filters.difficulties.length > 0) {
    const codes = DIFF_ORDER.filter((d) => filters.difficulties.includes(d)).map(
      (d) => Object.keys(DIFF_CODES).find((k) => DIFF_CODES[k] === d) ?? "",
    );
    params.set("diff", codes.join(","));
  }
  if (filters.version) params.set("ver", filters.version);
  return params.toString();
}

/** 필터를 서버 조건으로 바꾼다. 폴더 목록과 폴더 안 채보 목록이 같은 조건을 쓰므로 개수가 맞는다. */
function filterQuery(filters: SongListFilters) {
  return {
    q: filters.q.trim() || null,
    part: filters.part,
    difficulty: filters.difficulties.length > 0 ? filters.difficulties.join(",") : null,
    version: filters.version,
  };
}

/** 레벨 폴더 목록. 필터를 주면 맞는 채보만으로 폴더가 만들어진다(맞는 채보가 없는 폴더는 오지 않는다). */
export function fetchChartFolders(signal?: AbortSignal, filters: SongListFilters = EMPTY_SONG_FILTERS): Promise<ChartFolderListResponse> {
  return apiFetch<ChartFolderListResponse>("/songs/chart-folders", { query: filterQuery(filters), signal });
}

/** 폴더 안 채보 한 페이지. folder는 폴더 시작 레벨(예: 9.5), step은 그 단위. 단위의 배수가 아니면 서버가 400으로 거절한다. */
export function fetchFolderCharts(
  lo: number,
  step: FolderStep,
  page: number,
  signal?: AbortSignal,
  filters: SongListFilters = EMPTY_SONG_FILTERS,
  size: number = CHARTS_PAGE_SIZE,
): Promise<PageResponse<ChartRowResponse>> {
  return apiFetch<PageResponse<ChartRowResponse>>("/songs/charts", {
    query: { ...filterQuery(filters), folder: lo.toFixed(2), folderStep: step, page, size },
    signal,
  });
}

/** 폴더 제목 `9.50 ~ 9.99`. */
export function folderTitle(folder: Pick<ChartFolderResponse, "lo" | "hi">): string {
  return `${formatLevel(folder.lo)} ~ ${formatLevel(folder.hi)}`;
}

/** 곡 상세 주소 (곡 목록에서 들어온 것). */
export function songListDetailHref(row: Pick<ChartRowResponse, "songId" | "songDifficultyId">): string {
  return `/songs/${row.songId}?from=songs&chart=${row.songDifficultyId}`;
}

/** 폴더 평균. "0% 포함"이면 기록 없는 채보를 0%로 넣은 값, 아니면 기록 있는 채보만의 값(없으면 null). */
export function folderAverage(folder: ChartFolderResponse, includeZero: boolean): number | null {
  return includeZero ? folder.averageWithZero : folder.averageRecorded;
}

/** 검색창 아래 후보 목록에 보이는 채보 수. 더 보고 싶으면 아래 폴더 목록(같은 검색어로 걸러진다)을 본다. */
export const CANDIDATES_SIZE = 8;

/** 곡 목록 검색창의 바로가기 후보. 폴더 없이 검색어만 줘서 곡 목록과 같은 검색 규칙(한글·일본어·로마자·별칭)을 쓴다. */
export function fetchChartCandidates(q: string, signal?: AbortSignal): Promise<PageResponse<ChartRowResponse>> {
  return apiFetch<PageResponse<ChartRowResponse>>("/songs/charts", { query: { q, page: 0, size: CANDIDATES_SIZE }, signal });
}
