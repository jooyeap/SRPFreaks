import { apiFetch } from "@/lib/api";
import type {
  ChartRowResponse,
  PageResponse,
  RateBucketKey,
  RateBucketResponse,
  RateFolderListResponse,
  RateFolderResponse,
  TableEntryResponse,
} from "@/lib/api-types";
import type { InstrumentPart } from "@/lib/types";
import type { StageCounts } from "@/components/table/StageBar";
import { EMPTY_MARK, formatLevel, formatTier } from "@/lib/format";
import type { Translator } from "@/i18n/translator";
import type { MessageKey } from "@/i18n/translator";

/** 통계 쿼리 키. 앞부분 "stats"는 records.ts의 AFFECTED_QUERY_KEYS와 같다: 기록을 저장/수정/삭제하면 무효화된다. 내 기록이 섞이므로 사용자 id를 넣는다. */
export const statsKeys = {
  levelFolders: (userId: number) => ["stats", "level-folders", userId] as const,
  tierFolders: (userId: number, tableId: number) => ["stats", "tier-folders", userId, tableId] as const,
};

export function fetchLevelRateFolders(signal?: AbortSignal): Promise<RateFolderListResponse> {
  return apiFetch<RateFolderListResponse>("/stats/level-rate-folders", { signal });
}

export function fetchTierRateFolders(tableId: number, signal?: AbortSignal): Promise<RateFolderListResponse> {
  return apiFetch<RateFolderListResponse>("/stats/tier-rate-folders", { query: { tableId }, signal });
}

/** 구간 표시 순서(위 -> 아래)와 이름. 서버가 주는 buckets도 이 순서지만, 화면은 이 표를 기준으로 그린다. */
export const BUCKETS: readonly { key: RateBucketKey; label: string }[] = [
  { key: "R95", label: "95 ~ 100%" },
  { key: "R90", label: "90 ~ 94.99%" },
  { key: "R85", label: "85 ~ 89.99%" },
  { key: "R80", label: "80 ~ 84.99%" },
  { key: "R73", label: "73 ~ 79.99%" },
  { key: "BELOW", label: "" },
  { key: "UNPLAYED", label: "" },
];

export function bucketLabel(key: RateBucketKey, t: Translator): string {
  // 숫자 구간(95 ~ 100%)은 어느 언어에서나 같아서 표의 글자를 쓰고, 글자가 들어가는 두 구간만 번역한다
  if (key === "BELOW") return t("MyPage.bucketBelow");
  if (key === "UNPLAYED") return t("MyPage.bucketUnplayed");
  return BUCKETS.find((b) => b.key === key)?.label ?? key;
}

/** 구간의 막대 색에 쓸 달성 단계. 구간 이름에 숫자가 같이 있으므로 색은 보조다. 미플레이는 색이 없다(null). */
export function bucketStage(key: RateBucketKey): "SS" | "S" | "A" | "C" | null {
  switch (key) {
    case "R95":
      return "SS";
    case "R90":
    case "R85":
    case "R80":
      return "S";
    case "R73":
      return "A";
    case "BELOW":
      return "C";
    default:
      return null;
  }
}

function bucketOf(folder: RateFolderResponse, key: RateBucketKey): RateBucketResponse {
  return folder.buckets.find((b) => b.bucket === key) ?? { bucket: key, count: 0, exc: 0, fc: 0 };
}

/** 폴더 평균. "0% 포함"이면 기록 없는 채보를 0%로 넣은 값, 아니면 기록 있는 채보만의 값(기록이 없으면 null). */
export function folderAverage(folder: RateFolderResponse, includeZero: boolean): number | null {
  return includeZero ? folder.averageWithZero : folder.averageRecorded;
}

/** 평균 표기. 소수 둘째 자리 + %. 기록이 없어 평균이 없으면 `–`. */
export function formatFolderAverage(value: number | null): string {
  return value === null ? EMPTY_MARK : `${value.toFixed(2)}%`;
}

/**
 * 폴더의 달성 단계별 개수(EXC / FC / SS / S / S 미만)와 전체 수. 폴더를 단계 색으로 밝힐지(groupStage) 정하는 데 쓴다.
 * 단계 규칙은 서버와 같다: 달성률 100.00 -> EXC, 풀콤보(100 미만) -> FC, 그다음은 95 이상 SS / 80 이상 S / 나머지 S 미만.
 * 구간 안의 EXC·FC를 먼저 빼고 남은 수를 구간이 정하는 단계(SS/S/S 미만)로 센다. 기록이 없는 채보(미플레이)는 어느 단계에도 세지 않는다.
 */
export function folderStageCounts(folder: RateFolderResponse): StageCounts & { total: number } {
  let exc = 0;
  let fc = 0;
  let ss = 0;
  let s = 0;
  let belowS = 0;
  for (const b of folder.buckets) {
    exc += b.exc;
    fc += b.fc;
    const rest = b.count - b.exc - b.fc;
    if (b.bucket === "R95") ss += rest;
    else if (b.bucket === "R90" || b.bucket === "R85" || b.bucket === "R80") s += rest;
    else if (b.bucket === "R73" || b.bucket === "BELOW") belowS += rest;
  }
  return { exc, fc, ss, s, belowS, total: folder.total };
}

/** 구간의 MAX / FC 개수 (95~100 구간 막대 아래 뱃지에 쓴다). */
export function bucketBadges(folder: RateFolderResponse, key: RateBucketKey): { max: number; fc: number } {
  const b = bucketOf(folder, key);
  return { max: b.exc, fc: b.fc };
}

export function bucketCount(folder: RateFolderResponse, key: RateBucketKey): number {
  return bucketOf(folder, key).count;
}

/** 통계 화면의 기준: 레벨 폴더(곡 목록 기준) 또는 서열표 난이도. */
export type StatsAxis = "level" | "tier";

/** 폴더 제목. 레벨 폴더는 `9.50 ~ 9.99`(0.5 단위), 서열표 난이도는 `5.8`. */
export function folderLabel(axis: StatsAxis, key: number, t: Translator): string {
  return axis === "level" ? `${formatLevel(key)} ~ ${formatLevel(key + 0.49)}` : formatTier(key, t);
}

/** 폴더 안 채보 목록 화면 주소. key는 소수 둘째 자리 문자열(부동소수 비교를 피한다). */
export function bucketListHref(axis: StatsAxis, key: number, bucket: RateBucketKey): string {
  const params = new URLSearchParams({ axis, key: key.toFixed(2), bucket });
  return `/me/folder?${params.toString()}`;
}

// ---- 폴더 안 채보 목록 (구간을 눌렀을 때) ----

export type FolderChartSort = "LEVEL" | "RATE_DESC" | "RATE_ASC";

export const FOLDER_SORT_OPTIONS: readonly { value: FolderChartSort; labelKey: MessageKey }[] = [
  { value: "LEVEL", labelKey: "MyPage.sortLevel" },
  { value: "RATE_DESC", labelKey: "MyPage.sortRateDesc" },
  { value: "RATE_ASC", labelKey: "MyPage.sortRateAsc" },
];

/** 폴더 목록 화면의 상태. 전부 주소 쿼리에 두어 새로고침·뒤로가기에도 유지된다. 폴더나 구간이 올바르지 않으면 null이다. */
export interface FolderViewState {
  axis: StatsAxis;
  /** 레벨 폴더 시작 레벨(9.5) 또는 서열표 난이도(5.8) */
  key: number;
  bucket: RateBucketKey;
  part: InstrumentPart | null;
  sort: FolderChartSort;
}

const BUCKET_KEYS = new Set<string>(BUCKETS.map((b) => b.key));
const KEY_PATTERN = /^\d{1,2}\.\d{2}$/;

/** 주소는 사용자가 고칠 수 있다: 알 수 없는 값은 버리고, 폴더·구간이 없거나 틀리면 null(화면이 안내를 띄운다). */
export function folderViewFromParams(params: URLSearchParams): FolderViewState | null {
  const axis = params.get("axis");
  const rawKey = params.get("key") ?? "";
  const bucket = params.get("bucket") ?? "";
  if ((axis !== "level" && axis !== "tier") || !KEY_PATTERN.test(rawKey) || !BUCKET_KEYS.has(bucket)) {
    return null;
  }
  const sort = params.get("sort");
  return {
    axis,
    key: Number(rawKey),
    bucket: bucket as RateBucketKey,
    part: params.get("part") === "G" ? "GUITAR" : params.get("part") === "B" ? "BASS" : null,
    sort: sort === "RATE_DESC" || sort === "RATE_ASC" ? sort : "LEVEL",
  };
}

/** 기본값(전체 파트, 레벨 높은 순)은 쓰지 않는다. */
export function folderViewToQuery(state: FolderViewState): string {
  const params = new URLSearchParams({ axis: state.axis, key: state.key.toFixed(2), bucket: state.bucket });
  if (state.part) params.set("part", state.part === "GUITAR" ? "G" : "B");
  if (state.sort !== "LEVEL") params.set("sort", state.sort);
  return params.toString();
}

export const FOLDER_CHARTS_PAGE_SIZE = 20;

export const folderChartsKeys = {
  list: (userId: number, tableId: number | null, state: FolderViewState) =>
    ["stats", "folder-charts", userId, tableId, state] as const,
};

/** 폴더·구간 안의 채보 한 페이지를 곡 목록 줄 모양으로 돌려준다. 레벨 폴더는 곡 목록 API, 서열표 난이도는 통계 API를 쓴다. */
export async function fetchFolderBucketCharts(
  state: FolderViewState,
  tableId: number | null,
  page: number,
  signal?: AbortSignal,
): Promise<PageResponse<ChartRowResponse>> {
  const common = { rateBucket: state.bucket, part: state.part, sort: state.sort, page, size: FOLDER_CHARTS_PAGE_SIZE };
  if (state.axis === "level") {
    return apiFetch<PageResponse<ChartRowResponse>>("/songs/charts", {
      query: { folder: state.key.toFixed(2), folderStep: "0.50", ...common },
      signal,
    });
  }
  const result = await apiFetch<PageResponse<TableEntryResponse>>("/stats/tier-rate-folders/charts", {
    query: { tableId, tier: state.key.toFixed(1), ...common },
    signal,
  });
  return { ...result, content: result.content.map(entryToChartRow) };
}

/** 서열표 줄을 곡 목록 줄과 같은 모양으로 바꾼다(두 기준이 같은 줄 컴포넌트를 쓰게). 속성·추천 같은 서열표 값은 이 목록에서 쓰지 않는다. */
export function entryToChartRow(entry: TableEntryResponse): ChartRowResponse {
  return {
    songDifficultyId: entry.songDifficultyId,
    songId: entry.songId,
    title: entry.title,
    addedVersion: entry.addedVersion,
    part: entry.part,
    difficulty: entry.difficulty,
    level: entry.level,
    mine: entry.mine,
  };
}
