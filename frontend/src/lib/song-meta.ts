import type { Translator } from "@/i18n/translator";
import { apiFetch } from "@/lib/api";
import type { PageResponse, SongDetailResponse, TitleKind } from "@/lib/api-types";
import { ALIAS_MAX_LENGTH, MAX_TITLES, parseBpmInput, SONG_EDIT_AFFECTED_KEYS, type BpmField, type SongUpdateBody } from "@/lib/song-admin";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/**
 * 곡 정보 정리(D91, ROOT·ADMIN): 아티스트·검색 키워드·BPM(D105)이 비어 있는 곡만 모아 채워 넣는 화면의 API 호출과 계산.
 * 목록만 새 API(GET /admin/song-meta/todo, 읽기 전용)이고, 저장·되돌리기는 기존 곡 수정 API(PUT /songs/{id}, D22)를 그대로 쓴다.
 * 곡 삭제·신규 등록은 이 화면에 없다. 감사 로그(SONG_UPDATE)는 서버가 곡 수정과 같은 규칙으로 남긴다.
 */

/** 화면 칩과 1:1. ANY = 전체 미등록(아티스트·키워드), ARTIST = 아티스트 없음, KEYWORD = 검색 키워드 없음, BOTH = 둘 다, BPM = BPM 없음(D105). 서버 화이트리스트와 같다. */
export type SongMetaFilter = "ANY" | "ARTIST" | "KEYWORD" | "BOTH" | "BPM";
export const SONG_META_FILTERS: readonly SongMetaFilter[] = ["ANY", "ARTIST", "KEYWORD", "BOTH", "BPM"];

/** 한 쪽에 보이는 곡 수(시안: 20개씩). */
export const SONG_META_PAGE_SIZE = 20;

export interface SongMetaSummary {
  totalSongs: number;
  noArtist: number;
  noKeyword: number;
  bothMissing: number;
  /** 아티스트 없음 + 키워드 없음 - 둘 다(중복 없이 센 전체 미등록) */
  anyMissing: number;
  /** BPM 최소·최대가 모두 비어 있는 곡 수(D105). 전체 미등록(anyMissing)에는 들어 있지 않다 */
  noBpm: number;
}

export interface SongMetaRow {
  songId: number;
  title: string;
  artist: string | null;
  /** 둘 다 null이면 BPM 없음(D105) */
  bpmMin: number | null;
  bpmMax: number | null;
  /** song_titles 행 수. 0이면 검색 키워드가 없다 */
  titleCount: number;
  topPart: InstrumentPart | null;
  topDifficulty: DifficultyType | null;
  topLevel: number | null;
}

export interface SongMetaTodoResponse {
  summary: SongMetaSummary;
  page: PageResponse<SongMetaRow>;
}

export const songMetaKeys = {
  all: ["admin", "song-meta"] as const,
  todo: (viewerId: number, filter: SongMetaFilter, q: string, page: number) => ["admin", "song-meta", viewerId, filter, q, page] as const,
};

export function fetchSongMetaTodo(filter: SongMetaFilter, q: string, page: number, signal?: AbortSignal): Promise<SongMetaTodoResponse> {
  const query: Record<string, string | number> = { filter, page, size: SONG_META_PAGE_SIZE };
  if (q) query.q = q;
  return apiFetch<SongMetaTodoResponse>("/admin/song-meta/todo", { query, signal });
}

/** 줄 상태: 아티스트가 비어 있나, 검색 키워드가 비어 있나, BPM이 비어 있나(최소·최대 모두 없음, D105). */
export function missingOf(row: Pick<SongMetaRow, "artist" | "titleCount" | "bpmMin" | "bpmMax">): { artist: boolean; keyword: boolean; bpm: boolean } {
  return { artist: row.artist === null || row.artist.trim() === "", keyword: row.titleCount === 0, bpm: row.bpmMin === null && row.bpmMax === null };
}

/** 줄에서 입력한 BPM(검사를 통과한 값). 최소만 쓰면 max는 min과 같다. */
export interface NewBpm {
  min: number;
  max: number;
}

/**
 * BPM 입력 글자를 검사해 저장용 값으로 바꾼다(검사 규칙은 곡 수정 창과 같은 parseBpmInput).
 * 둘 다 비어 있으면 입력 없음(ok, bpm = null). 오류면 어느 칸인지와 안내 문구를 돌려준다.
 */
export function readBpmDraft(minText: string, maxText: string, t: Translator): { ok: true; bpm: NewBpm | null } | { ok: false; field: BpmField; message: string } {
  const result = parseBpmInput(minText, maxText, t);
  if (!result.ok) {
    return result;
  }
  return { ok: true, bpm: result.min === null || result.max === null ? null : { min: result.min, max: result.max } };
}

/** 새로 넣을 검색 키워드 하나(곡명 표기). */
export interface NewKeyword {
  kind: TitleKind;
  title: string;
}

export const KEYWORD_KINDS: readonly TitleKind[] = ["ROMAJI", "KANA", "KO", "ALIAS"];

/** 같은 키워드인지 비교하는 값: NFKC로 맞추고 공백을 없애고 소문자로 (서버의 normalized_title과 같은 규칙). 같은 종류 안에서만 중복이다. */
function keyOf(item: NewKeyword): string {
  return `${item.kind}:${item.title.normalize("NFKC").replace(/\s+/g, "").toLowerCase()}`;
}

export type AddKeywordResult = { ok: true; keywords: NewKeyword[] } | { ok: false; message: string };

/** 키워드 하나를 목록 끝에 더한다. 검사에 걸리면 목록은 그대로 두고 안내 문구를 돌려준다. 입력 배열은 바꾸지 않는다. */
export function addKeyword(current: readonly NewKeyword[], kind: TitleKind, text: string, t: Translator): AddKeywordResult {
  const title = text.trim();
  if (title === "") {
    return { ok: false, message: t("Validation.aliasRequired") };
  }
  if (title.length > ALIAS_MAX_LENGTH) {
    return { ok: false, message: t("Validation.aliasMax", { max: ALIAS_MAX_LENGTH }) };
  }
  const next: NewKeyword = { kind, title };
  if (current.some((existing) => keyOf(existing) === keyOf(next))) {
    return { ok: false, message: t("Validation.aliasDuplicate") };
  }
  if (current.length >= MAX_TITLES) {
    return { ok: false, message: t("Validation.aliasLimit", { limit: MAX_TITLES }) };
  }
  return { ok: true, keywords: [...current, next] };
}

/** 이 줄을 저장할 수 있는가: 비어 있는 칸 중 하나라도 채워졌을 때. */
export function canSaveMeta(row: SongMetaRow, artist: string, keywords: readonly NewKeyword[], bpmMin = "", bpmMax = ""): boolean {
  const missing = missingOf(row);
  // BPM은 글자가 한 칸이라도 있으면 저장을 눌러 볼 수 있다(옳은 값인지는 저장할 때 검사해서 안내한다)
  return (missing.artist && artist.trim() !== "") || (missing.keyword && keywords.length > 0) || (missing.bpm && (bpmMin.trim() !== "" || bpmMax.trim() !== ""));
}

/**
 * PUT /songs/{id} 본문을 만든다. 서버 수정은 "보낸 값으로 교체"라서 화면에 없는 값(버전·폴더·BPM)은 지금 값을 그대로 보내야 지워지지 않는다.
 * 아티스트는 비어 있던 줄만 입력값으로 바꾸고(이미 있으면 그대로), 키워드가 있으면 titles를 통째로(기존 표기 + 새 키워드) 보낸다.
 */
export function toMetaSaveBody(detail: SongDetailResponse, artist: string, keywords: readonly NewKeyword[], bpm: NewBpm | null = null): SongUpdateBody {
  const hasArtist = detail.artist !== null && detail.artist.trim() !== "";
  // BPM도 아티스트처럼 최신 상세에서 비어 있을 때만 입력값으로 채운다(그 사이 다른 관리자가 채웠다면 그 값을 그대로 둔다)
  const hasBpm = detail.bpmMin !== null || detail.bpmMax !== null;
  const body: SongUpdateBody = {
    title: detail.title,
    artist: hasArtist ? detail.artist : artist.trim() === "" ? null : artist.trim(),
    addedVersion: detail.addedVersion,
    titleFolder: detail.titleFolder,
    bpmMin: !hasBpm && bpm ? bpm.min : detail.bpmMin,
    bpmMax: !hasBpm && bpm ? bpm.max : detail.bpmMax,
  };
  if (keywords.length === 0) {
    return body;
  }
  const existing = detail.titles.map((t) => ({ kind: t.kind, title: t.title }));
  const seen = new Set(existing.map(keyOf));
  return { ...body, titles: [...existing, ...keywords.filter((k) => !seen.has(keyOf(k)))] };
}

/**
 * 되돌리기 본문: 저장 직전 모습 그대로. 이번 저장이 곡명 표기를 바꿨을 때만 titles를 보낸다(바꾸지 않았다면 생략 = 서버가 그대로 둔다).
 * 키워드를 넣지 않고 아티스트만 저장했다면 titles를 건드리지 않으므로 되돌릴 때도 건드리지 않는다.
 */
export function toMetaRestoreBody(before: SongDetailResponse, savedTitles: boolean): SongUpdateBody {
  const body: SongUpdateBody = {
    title: before.title,
    artist: before.artist,
    addedVersion: before.addedVersion,
    titleFolder: before.titleFolder,
    bpmMin: before.bpmMin,
    bpmMax: before.bpmMax,
  };
  return savedTitles ? { ...body, titles: before.titles.map((t) => ({ kind: t.kind, title: t.title })) } : body;
}

/** 저장 결과. 되돌리기 안내가 쓰는 값(곡 번호·곡명·되돌리기 본문)을 같이 돌려준다. */
export interface MetaSaved {
  songId: number;
  title: string;
  restore: SongUpdateBody;
}

/**
 * 저장: 최신 곡 상세를 먼저 읽고(다른 관리자가 그 사이 바꾼 값을 덮어쓰지 않도록) 그 위에 입력값을 얹어 PUT한다.
 * 삭제됐거나 없는 곡이면 서버가 404를 준다(그대로 화면에 안내).
 */
export async function saveSongMeta(songId: number, artist: string, keywords: readonly NewKeyword[], bpm: NewBpm | null = null): Promise<MetaSaved> {
  const before = await apiFetch<SongDetailResponse>(`/songs/${songId}`);
  const body = toMetaSaveBody(before, artist, keywords, bpm);
  await apiFetch<SongDetailResponse>(`/songs/${songId}`, { method: "PUT", body });
  return { songId, title: before.title, restore: toMetaRestoreBody(before, body.titles !== undefined) };
}

/** 되돌리기: 저장 직전 본문을 다시 PUT한다. 이번 저장 한 건만 되돌린다(이력은 따로 두지 않는다). */
export function restoreSongMeta(saved: MetaSaved): Promise<SongDetailResponse> {
  return apiFetch<SongDetailResponse>(`/songs/${saved.songId}`, { method: "PUT", body: saved.restore });
}

/** 저장·되돌리기 뒤에 다시 받아야 하는 화면: 이 목록, 곡 목록·곡 상세 등, 감사 로그. */
export const SONG_META_AFFECTED_KEYS = [songMetaKeys.all, ...SONG_EDIT_AFFECTED_KEYS, ["admin", "audit-logs"]] as const;
