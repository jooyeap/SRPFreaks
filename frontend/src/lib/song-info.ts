import { apiFetch } from "@/lib/api";
import type { InfoRow } from "@/lib/jacket-reader";

/** 곡 정보(아티스트·BPM) 가져오기 (D90, ROOT 전용). 백엔드 SongInfoPreviewResponse·SongInfoCommitResponse와 같은 모양. */

/** FILL=새로 채움, OVERWRITE=덮어쓰기, UNCHANGED=변경 없음, NONE=값 없음 */
export type InfoStatus = "FILL" | "OVERWRITE" | "UNCHANGED" | "NONE";

export interface ArtistChange {
  current: string | null;
  official: string | null;
  status: InfoStatus;
}

export interface BpmChange {
  currentMin: number | null;
  currentMax: number | null;
  officialMin: number | null;
  officialMax: number | null;
  status: InfoStatus;
}

export interface SongInfoRow {
  officialTitle: string;
  songId: number;
  songTitle: string;
  artist: ArtistChange;
  bpm: BpmChange;
}

export interface SongInfoPreview {
  readSongs: number;
  matchedSongs: number;
  unmatchedCount: number;
  rows: SongInfoRow[];
}

export interface SongInfoSelection {
  songId: number;
  artist: boolean;
  bpm: boolean;
}

export interface SongInfoCommitResult {
  artistFilled: number;
  artistOverwritten: number;
  bpmFilled: number;
  bpmOverwritten: number;
  skipped: number;
}

/** 저장은 서버 한도(4,000건)보다 작게 나눠 보낸다. 요청 본문은 nginx 한도(1MB) 안에 든다. */
export const COMMIT_BATCH = 500;

/** 저장하지 않고 마스터와 곡명이 맞은 곡의 현재값 → 가져온 값을 받는다. */
export function previewSongInfo(songs: InfoRow[]): Promise<SongInfoPreview> {
  return apiFetch<SongInfoPreview>("/admin/song-info-imports/preview", { method: "POST", body: { songs } });
}

/** 고른 곡·항목을 저장한다. songs는 고른 곡의 공식 값만 보내면 된다. */
export function commitSongInfo(songs: InfoRow[], selections: SongInfoSelection[]): Promise<SongInfoCommitResult> {
  return apiFetch<SongInfoCommitResult>("/admin/song-info-imports/commit", { method: "POST", body: { songs, selections } });
}

/** BPM 표시: 고정이면 `172`, 가변이면 `120–180`, 없으면 `–`. */
export function formatBpm(min: number | null, max: number | null): string {
  if (min === null && max === null) return "–";
  if (min === null || max === null || min === max) return String(min ?? max);
  return `${min}–${max}`;
}

/** 저장되는 값이 바뀌는 상태인가(새로 채움·덮어쓰기). 변경 없음·값 없음은 저장할 것이 없다. */
export function isWritable(status: InfoStatus): boolean {
  return status === "FILL" || status === "OVERWRITE";
}

/**
 * BPM 글자 모양: 정수 1~4자리의 `172`, 또는 `120-180`(하이픈·물결표·긴 줄표). NFKC 정규화 뒤에 비교한다.
 * 서버 SongInfoImportService.BPM_PATTERN과 같은 모양이고, RemyWiki 읽기 북마클릿(remywiki-reader.ts)도 이 글자를 그대로 쓴다.
 */
export const BPM_TEXT_SOURCE = "^(\\d{1,4})(?:\\s*[-~\\u2013\\u2014\\u301C]\\s*(\\d{1,4}))?$";

export const MIN_BPM = 1;
export const MAX_BPM = 2000;

/** BPM 글자를 {min, max}로. 고정 `172` → {172, 172}. 정수 1~2000이 아니거나 최소가 최대보다 크면 null(서버의 `값 없음`과 같다). */
export function parseBpmText(raw: string): { min: number; max: number } | null {
  const m = new RegExp(BPM_TEXT_SOURCE).exec(raw.normalize("NFKC").trim());
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] === undefined ? min : Number(m[2]);
  if (min < MIN_BPM || max > MAX_BPM || min > max) return null;
  return { min, max };
}
