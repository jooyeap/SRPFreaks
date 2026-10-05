import { apiFetch } from "@/lib/api";
import type {
  SongChartResponse,
  SongDetailResponse,
  TableEntryResponse,
  TierGroupResponse,
} from "@/lib/api-types";
import { EMPTY_MARK } from "@/lib/format";
import type { DifficultyType } from "@/lib/types";

export const songKeys = {
  detail: (songId: number) => ["songs", songId] as const,
};

export function fetchSongDetail(songId: number, signal?: AbortSignal): Promise<SongDetailResponse> {
  return apiFetch<SongDetailResponse>(`/songs/${songId}`, { signal });
}

/** 곡 상세에 어디서 들어왔는지. 구성이 다르다 (DESIGN-UI 6장). 알 수 없는 값은 곡 목록으로 취급한다. */
export type SongDetailOrigin = "table" | "songs";

export function parseOrigin(value: string | null | undefined): SongDetailOrigin {
  return value === "table" ? "table" : "songs";
}

/** 주소의 숫자 파라미터(곡 id, 채보 id)를 안전하게 읽는다. 양의 정수가 아니면 null. */
export function parseId(value: string | string[] | null | undefined): number | null {
  if (typeof value !== "string" || !/^\d{1,15}$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const DIFFICULTY_ORDER: Record<DifficultyType, number> = { BASIC: 0, ADVANCED: 1, EXTREME: 2, MASTER: 3 };

/** 채보 정렬: Guitar 먼저, 같은 파트 안에서는 BAS -> ADV -> EXT -> MAS. 원본 배열은 바꾸지 않는다. */
export function sortCharts<T extends { instrumentPart: string; difficultyType: DifficultyType }>(charts: readonly T[]): T[] {
  return [...charts].sort((a, b) => {
    if (a.instrumentPart !== b.instrumentPart) {
      return a.instrumentPart === "GUITAR" ? -1 : 1;
    }
    return DIFFICULTY_ORDER[a.difficultyType] - DIFFICULTY_ORDER[b.difficultyType];
  });
}

/**
 * 화면에서 선택할 채보를 정한다. 요청한 채보가 이 곡의 것이면 그대로, 아니면(없거나 다른 곡의 id) 레벨이 가장 높은 채보.
 * 주소의 chart 값은 사용자가 마음대로 바꿀 수 있어서 반드시 이 곡의 채보인지 확인한다. 채보가 하나도 없으면 null.
 */
export function resolveChart(charts: readonly SongChartResponse[], requestedId: number | null): SongChartResponse | null {
  if (charts.length === 0) {
    return null;
  }
  const requested = charts.find((c) => c.id === requestedId);
  if (requested) {
    return requested;
  }
  return sortCharts(charts).reduce((best, c) => (c.level > best.level ? c : best));
}

/** BPM 표기: 같으면 `150`, 범위면 `120~180`, 하나라도 없으면 있는 값만, 둘 다 없으면 `–`. */
export function formatBpm(min: number | null, max: number | null): string {
  if (min === null && max === null) {
    return EMPTY_MARK;
  }
  if (min === null || max === null || min === max) {
    return String(min ?? max);
  }
  return `${min}~${max}`;
}

/** 노트 수 표기: 천 단위 쉼표. 비어 있으면 `–`. */
export function formatNoteCount(count: number | null | undefined): string {
  return count === null || count === undefined ? EMPTY_MARK : count.toLocaleString("en-US");
}

// ---- 서열표 전체에서 곡/채보 찾기 ---------------------------------------------------------------

/** 서열표 전체에서 채보 하나가 속한 묶음과 그 안에서의 위치. 서열표에 없으면 null. */
export function findChart(
  groups: readonly TierGroupResponse[],
  songDifficultyId: number,
): { group: TierGroupResponse; index: number; entry: TableEntryResponse } | null {
  for (const group of groups) {
    const index = group.entries.findIndex((e) => e.songDifficultyId === songDifficultyId);
    if (index >= 0) {
      return { group, index, entry: group.entries[index] };
    }
  }
  return null;
}

/** 서열표에 있는 이 곡의 채보들을 (파트, 난이도) 순으로. */
export function entriesOfSong(groups: readonly TierGroupResponse[], songId: number): TableEntryResponse[] {
  const found = groups.flatMap((g) => g.entries).filter((e) => e.songId === songId);
  return [...found].sort((a, b) => {
    if (a.part !== b.part) {
      return a.part === "GUITAR" ? -1 : 1;
    }
    return DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
  });
}

/** 묶음 안에서 앞/뒤 채보 (묶음 경계 너머는 보지 않는다). 없으면 null. */
export function neighbors(
  group: TierGroupResponse,
  index: number,
): { prev: TableEntryResponse | null; next: TableEntryResponse | null } {
  return { prev: group.entries[index - 1] ?? null, next: group.entries[index + 1] ?? null };
}
