import { apiFetch } from "@/lib/api";
import type { RateBucketKey, RateBucketResponse, RateFolderListResponse, RateFolderResponse } from "@/lib/api-types";
import type { StageCounts } from "@/components/table/StageBar";
import { formatLevel, formatTier } from "@/lib/format";

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
  { key: "BELOW", label: "73% 미만" },
  { key: "UNPLAYED", label: "미플레이" },
];

export function bucketLabel(key: RateBucketKey): string {
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
export function folderLabel(axis: StatsAxis, key: number): string {
  return axis === "level" ? `${formatLevel(key)} ~ ${formatLevel(key + 0.49)}` : formatTier(key);
}

/** 폴더 안 채보 목록 화면 주소. key는 소수 둘째 자리 문자열(부동소수 비교를 피한다). */
export function bucketListHref(axis: StatsAxis, key: number, bucket: RateBucketKey): string {
  const params = new URLSearchParams({ axis, key: key.toFixed(2), bucket });
  return `/me/folder?${params.toString()}`;
}
