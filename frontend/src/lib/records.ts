import { apiFetch } from "@/lib/api";
import type { PageResponse } from "@/lib/api-types";
import { formatPlayedDate, formatScore, rateFromInput, rateToInput } from "@/lib/format";
import type { RecordFormValues } from "@/lib/record-schema";
import type { DifficultyType, InstrumentPart, NoteOption, AchievementStage } from "@/lib/types";
import type { Translator } from "@/i18n/translator";

/** 서버 RecordResponse와 같은 모양. */
export interface RecordResponse {
  id: number;
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  noteOption: NoteOption;
  achievementRate: number;
  fullCombo: boolean;
  stage: AchievementStage;
  playedAt: string | null;
  platform: string | null;
  memo: string | null;
  /** 서버가 기록한 등록 시각(UTC). playedAt(사용자가 입력한 플레이 시각)과 다르다 */
  createdAt: string;
  /** 마지막 수정 시각(UTC). 수정한 적이 없으면 createdAt과 같다 */
  updatedAt: string;
  /** 저장(등록·수정) 응답에만 있다: 이 저장으로 내 레이팅이 어떻게 바뀌었는지. 목록·상세 응답과 계산에 실패했을 때는 없다 */
  ratingChange?: RatingChange | null;
}

/** 서버 RatingChangeResponse와 같은 모양 (D32 확장). */
export interface RatingChange {
  totalBefore: number;
  totalAfter: number;
  change: number;
  /** 이 저장으로 이 채보가 레이팅 목록(단일 15 + 그 외 25)에 새로 들어갔는가 */
  entered: boolean;
  /** 저장 뒤에 이 채보가 레이팅 목록에 들어 있는가 */
  inList: boolean;
}

/**
 * 저장 직후 알림에 덧붙이는 레이팅 변화 한 줄. 증감은 부호 글자(+/-)로 쓴다.
 *  - 새로 들어옴: `레이팅 +3.40 (100.00 → 103.40) · NEW 레이팅 목록에 새로 들어갔습니다.`
 *  - 목록 밖: 점수가 올라도 레이팅은 그대로라서 이유를 알려 준다
 * 서버가 변화를 주지 않았으면(계산 실패 등) null이라 알림에 아무것도 붙이지 않는다.
 */
export function ratingChangeText(change: RatingChange | null | undefined, t: Translator): string | null {
  if (!change) {
    return null;
  }
  if (!change.inList) {
    return t("Record.notInListYet");
  }
  if (change.change === 0) {
    return t("Record.ratingSame");
  }
  const sign = change.change > 0 ? "+" : "-";
  return t(change.entered ? "Record.ratingChangeNew" : "Record.ratingChange", {
    sign,
    change: formatScore(Math.abs(change.change)),
    before: formatScore(change.totalBefore),
    after: formatScore(change.totalAfter),
  });
}

/** 등록 직후 몇 초 차이는 수정으로 보지 않는다 */
const EDITED_THRESHOLD_MS = 60_000;

/** 목록·기록 창에 보이는 "등록 2026-10-12 · 수정 2026-10-14" 글자. 고친 적이 없으면 등록만 보인다. */
export function recordOriginText(record: Pick<RecordResponse, "createdAt" | "updatedAt">, t: Translator): string {
  const created = formatPlayedDate(record.createdAt);
  return isEdited(record)
    ? t("Record.originEdited", { created, edited: formatPlayedDate(record.updatedAt) })
    : t("Record.originCreated", { date: created });
}

/** 등록한 뒤 고친 적이 있는가 (updatedAt이 createdAt보다 1분 넘게 뒤). */
export function isEdited(record: Pick<RecordResponse, "createdAt" | "updatedAt">): boolean {
  const created = new Date(record.createdAt).getTime();
  const updated = new Date(record.updatedAt).getTime();
  return !Number.isNaN(created) && !Number.isNaN(updated) && updated - created > EDITED_THRESHOLD_MS;
}

/** 서버 RecordRequest와 같은 모양. */
export interface RecordRequestBody {
  songDifficultyId: number;
  noteOption: NoteOption;
  achievementRate: number;
  fullCombo: boolean;
  playedAt: string;
  memo: string | null;
}

/** 오늘(Asia/Seoul) 날짜 `YYYY-MM-DD`. */
export function todaySeoul(): string {
  return formatPlayedDate(new Date().toISOString());
}

/** 달성률 100.00이면 풀콤보는 항상 true (서버도 같은 규칙, D24). 문자열이 숫자가 아니면 false. */
export function isMaxRate(rate: string): boolean {
  return rateFromInput(rate) === 100;
}

/**
 * 서울 기준 날짜(`2026-10-05`)를 UTC 시각 문자열로 바꾼다. 그날 서울 0시를 뜻한다.
 * 서버는 시간을 UTC(Instant)로 저장하고 화면에서만 서울로 바꾸므로(CLAUDE.md), 보내는 쪽에서 오프셋(+09:00)을 붙여 변환한다.
 * 오늘 날짜를 골라도 서울 0시는 이미 지난 시각이라 서버의 "미래 시각 거부" 검사에 걸리지 않는다.
 */
export function seoulDateToInstant(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

/** 폼 값 -> 서버 요청. 노트 옵션은 SRN+ 하나만 받으므로(D25) 항상 SRN+를 보낸다. */
export function toRecordRequest(songDifficultyId: number, values: RecordFormValues): RecordRequestBody {
  const memo = values.memo.trim();
  return {
    songDifficultyId,
    noteOption: "SUPER_RANDOM_PLUS",
    achievementRate: rateFromInput(values.achievementRate) ?? 0, // 입력칸은 정수(9971) → 99.71. 스키마가 먼저 거르므로 0은 오지 않는다
    fullCombo: values.fullCombo || isMaxRate(values.achievementRate),
    playedAt: seoulDateToInstant(values.playedDate),
    memo: memo === "" ? null : memo,
  };
}

export function createRecord(body: RecordRequestBody): Promise<RecordResponse> {
  return apiFetch<RecordResponse>("/records", { method: "POST", body });
}

export function updateRecord(recordId: number, body: RecordRequestBody): Promise<RecordResponse> {
  return apiFetch<RecordResponse>(`/records/${recordId}`, { method: "PUT", body });
}

export function deleteRecord(recordId: number): Promise<void> {
  return apiFetch(`/records/${recordId}`, { method: "DELETE" });
}

/** 한 채보에 내가 남긴 기록 목록(최근 순). 한 페이지(최대 20건)만 가져온다. */
export const RECORDS_PER_CHART = 20;

export function fetchRecordsOfChart(songDifficultyId: number, signal?: AbortSignal): Promise<PageResponse<RecordResponse>> {
  return apiFetch<PageResponse<RecordResponse>>("/records", {
    query: { songDifficultyId, size: RECORDS_PER_CHART, sort: "recent" },
    signal,
  });
}

/** 내 기록 쿼리 키. 사용자 id를 넣어 계정이 바뀌어도 이전 사용자의 캐시를 보지 않게 한다. */
export const recordKeys = {
  ofChart: (userId: number, songDifficultyId: number) => ["records", userId, songDifficultyId] as const,
  bestOfChart: (userId: number, songDifficultyId: number) => ["records", userId, songDifficultyId, "best"] as const,
  recentEntered: (userId: number) => ["records", userId, "recent-entered"] as const,
};

/** 기록 창 맨 위 "최근 입력한 곡"에 보여 줄 곡 수 */
export const RECENT_CHART_COUNT = 5;

/**
 * 최근에 입력(등록·수정)한 채보를 새것부터 중복 없이 최대 `count`개 모은다.
 * 같은 채보를 여러 번 입력했으면 가장 최근 것만 센다. 입력 순서는 서버의 sort=entered(수정한 시각 최신순)를 따른다.
 */
export function distinctRecentCharts(records: readonly RecordResponse[], count: number = RECENT_CHART_COUNT): RecordResponse[] {
  const seen = new Set<number>();
  const result: RecordResponse[] = [];
  for (const record of records) {
    if (!seen.has(record.songDifficultyId)) {
      seen.add(record.songDifficultyId);
      result.push(record);
      if (result.length === count) {
        break;
      }
    }
  }
  return result;
}

/** 최근 입력한 기록들(중복 채보가 섞이므로 넉넉히 가져와 distinctRecentCharts로 줄인다). */
export function fetchRecentEntered(signal?: AbortSignal): Promise<PageResponse<RecordResponse>> {
  return apiFetch<PageResponse<RecordResponse>>("/records", { query: { sort: "entered", size: 20 }, signal });
}

/** 한 채보에서 달성률이 가장 높은 내 기록 1건 (없으면 null). 곡 상세의 "내 기록" 날짜에 쓴다. */
export async function fetchBestRecord(songDifficultyId: number, signal?: AbortSignal): Promise<RecordResponse | null> {
  const page = await apiFetch<PageResponse<RecordResponse>>("/records", {
    query: { songDifficultyId, sort: "rate", size: 1 },
    signal,
  });
  return page.content[0] ?? null;
}

/** 기록을 바꾼 뒤 화면에 영향을 받는 캐시(서열표, 이 채보의 기록 목록, 곡 목록의 내 기록, 세트리스트의 완료 표시)를 무효화할 때 쓰는 키들. */
export const AFFECTED_QUERY_KEYS = [["difficulty-tables"], ["records"], ["setlist"], ["skill"], ["song-list"], ["stats"]] as const;

/** 기존 기록 -> 폼 초기값. 달성률은 입력칸에 쓰는 정수 문자열로 만든다(91.25 → "9125"). */
export function recordToFormValues(record: RecordResponse): RecordFormValues {
  return {
    achievementRate: rateToInput(record.achievementRate),
    fullCombo: record.fullCombo,
    playedDate: record.playedAt ? formatPlayedDate(record.playedAt) : todaySeoul(),
    memo: record.memo ?? "",
  };
}
