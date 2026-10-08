import { z } from "zod";
import { apiFetch } from "@/lib/api";
import type { SongChartResponse, SongDetailResponse } from "@/lib/api-types";
import { saveTableEntry, tableEntrySchema, toTableEntryBody } from "@/lib/table-entry-admin";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/**
 * 곡 등록(ROOT·ADMIN)의 폼 검사와 API 호출. 서버(SongRequest, DifficultyCreateRequest)에도 같은 규칙이 있고,
 * 화면에서 먼저 막는 건 오류를 바로 알려 주려는 것이다. 곡 마스터는 자동으로 늘리지 않고 이 창으로만 직접 등록한다(D13, D23).
 */

export const PART_CHOICES: readonly InstrumentPart[] = ["GUITAR", "BASS"];
export const DIFFICULTY_CHOICES: readonly DifficultyType[] = ["BASIC", "ADVANCED", "EXTREME", "MASTER"];
/** 한 곡의 채보는 (파트 2 × 난이도 4) = 최대 8개다. */
export const MAX_CHARTS = PART_CHOICES.length * DIFFICULTY_CHOICES.length;
/** 곡을 이 창으로 등록했다는 출처 표시 (songs.source). 시드는 별도 출처로 들어간다. */
export const SONG_SOURCE = "admin-manual";

/** 정수 1자리 + 선택적 소수 1~2자리 → 0.00 ~ 9.99 (서버의 DecimalMin/Max, Digits와 같은 범위). */
const LEVEL_FORMAT = /^\d(\.\d{1,2})?$/;

/** 채보 한 줄. 서열표 값(기준 난이도·추천도·속성)은 서열표 화면에서 열었을 때만 쓰고, 곡 목록에서 열면 비워 둔 채로 무시한다. */
const chartSchema = tableEntrySchema.extend({
  part: z.enum(["GUITAR", "BASS"]),
  difficulty: z.enum(["BASIC", "ADVANCED", "EXTREME", "MASTER"]),
  level: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") {
        ctx.addIssue({ code: "custom", message: "레벨을 입력해 주세요." });
      } else if (!LEVEL_FORMAT.test(value)) {
        ctx.addIssue({ code: "custom", message: "레벨은 0.00 ~ 9.99 사이의 숫자로 입력해 주세요. (소수 둘째 자리까지)" });
      }
    }),
});

export const songCreateSchema = z
  .object({
    title: z.string().trim().min(1, "곡명을 입력해 주세요.").max(255, "곡명은 255자 이하여야 합니다."),
    artist: z.string().trim().max(255, "아티스트는 255자 이하여야 합니다."),
    addedVersion: z.string().trim().max(30, "버전은 30자 이하여야 합니다."),
    charts: z.array(chartSchema).min(1, "채보를 하나 이상 입력해 주세요.").max(MAX_CHARTS, `채보는 ${MAX_CHARTS}개까지 입력할 수 있습니다.`),
  })
  .superRefine((value, ctx) => {
    // (곡, 파트, 난이도)는 유일하다. 같은 조합을 두 번 쓰면 서버가 거절하므로 먼저 알려 준다.
    const seen = new Set<string>();
    value.charts.forEach((chart, index) => {
      const key = `${chart.part}|${chart.difficulty}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["charts", index, "difficulty"], message: "같은 파트·난이도의 채보가 이미 있습니다." });
      }
      seen.add(key);
    });
  });

export type SongCreateValues = z.infer<typeof songCreateSchema>;
export type ChartValues = SongCreateValues["charts"][number];

export function emptyChart(): ChartValues {
  return { part: "GUITAR", difficulty: "MASTER", level: "", tier: "", recommend: "", pattern: "" };
}

export function emptySongCreate(): SongCreateValues {
  return { title: "", artist: "", addedVersion: "", charts: [emptyChart()] };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** POST /songs 본문. BPM·노트 수·곡명 표기는 화면에 없으므로 보내지 않는다(null). */
export function toSongBody(values: SongCreateValues) {
  return {
    title: values.title.trim(),
    artist: blankToNull(values.artist),
    addedVersion: blankToNull(values.addedVersion),
    source: SONG_SOURCE,
  };
}

/** POST /songs/{id}/difficulties 본문. 레벨은 입력한 문자열을 숫자로 바꾼다(검사로 형식이 보장돼 있다). */
export function toChartBody(chart: ChartValues) {
  return { instrumentPart: chart.part, difficultyType: chart.difficulty, level: Number(chart.level), noteCount: null };
}

/**
 * 등록 진행 상태. 곡 → 채보 → (서열표 값)을 서버에 차례로 보내는데 한 번에 묶는 API가 없어서(트랜잭션 하나가 아니다),
 * 중간에 실패해도 이미 만든 것을 기억해 두었다가 다시 시도할 때 건너뛴다. 그래서 같은 곡이 두 번 만들어지지 않는다.
 */
export interface RegistrationProgress {
  songId: number | null;
  /** 채보 줄 번호 → 서버가 만든 채보 id */
  chartIds: Map<number, number>;
  /** 서열표 값까지 저장한 채보 줄 번호 */
  savedEntries: Set<number>;
}

export function newProgress(): RegistrationProgress {
  return { songId: null, chartIds: new Map(), savedEntries: new Set() };
}

/**
 * 곡과 채보를 등록하고 곡 id를 돌려준다. tableId가 있으면(서열표 화면에서 연 경우) 모든 채보를 서열표에도 추가한다.
 * 기준 난이도를 비우면 `미정`으로 들어가고, 미정은 레이팅 계산에서 빠진다(D18).
 * 실패하면 예외를 던지고 progress에 여기까지의 결과가 남는다. 같은 progress로 다시 부르면 남은 것만 이어서 보낸다.
 */
export async function registerSong(values: SongCreateValues, tableId: number | null, progress: RegistrationProgress): Promise<number> {
  if (progress.songId === null) {
    const song = await apiFetch<SongDetailResponse>("/songs", { method: "POST", body: toSongBody(values) });
    progress.songId = song.id;
  }
  for (const [index, chart] of values.charts.entries()) {
    let chartId = progress.chartIds.get(index);
    if (chartId === undefined) {
      const created = await apiFetch<SongChartResponse>(`/songs/${progress.songId}/difficulties`, {
        method: "POST",
        body: toChartBody(chart),
      });
      chartId = created.id;
      progress.chartIds.set(index, chartId);
    }
    if (tableId !== null && !progress.savedEntries.has(index)) {
      await saveTableEntry(tableId, chartId, toTableEntryBody(chart));
      progress.savedEntries.add(index);
    }
  }
  return progress.songId;
}

/** 등록하면 곡 목록·서열표·곡 상세·검색이 바뀐다. 레이팅은 기록이 없는 새 채보라 바뀌지 않지만 서열표 값이 들어가면 후보가 될 수 있어 함께 새로 받는다. */
export const SONG_CREATE_AFFECTED_KEYS = [["song-list"], ["difficulty-tables"], ["songs"], ["skill"]] as const;

/** 곡 삭제(소프트 삭제, ROOT·ADMIN). 서버가 곡의 채보도 보이지 않게 하고 관리 기록에 남긴다. */
export function deleteSong(songId: number): Promise<void> {
  return apiFetch<void>(`/songs/${songId}`, { method: "DELETE" });
}

/** 채보 하나만 삭제(소프트 삭제, ROOT·ADMIN). */
export function deleteChart(chartId: number): Promise<void> {
  return apiFetch<void>(`/difficulties/${chartId}`, { method: "DELETE" });
}

/** 삭제하면 곡 목록·서열표·곡 상세·레이팅·내 기록·유저 목록(총점)이 바뀐다. */
export const SONG_DELETE_AFFECTED_KEYS = [
  ["song-list"],
  ["difficulty-tables"],
  ["songs"],
  ["skill"],
  ["records"],
  ["players"],
] as const;
