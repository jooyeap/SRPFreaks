import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { FRAGMENT_PREFIX, MAX_SONGS, type ReadSong } from "@/lib/official-song-reader";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/**
 * 공식 곡 목록 아티스트·레벨 갱신 화면용 API와 규칙 (D42, ROOT 전용).
 * 북마클릿이 읽은 값은 주소 조각(#srpsong=)으로 오고, 확인(preview)과 반영(commit)은 로그인한 ROOT 계정으로 여기서 한다.
 */

const chartSchema = z.object({
  part: z.string().min(1).max(5),
  levels: z.array(z.string().max(10)).max(4),
});

const songSchema = z.object({
  title: z.string().min(1).max(255),
  artist: z.string().max(255),
  charts: z.array(chartSchema).max(8),
});

const fragmentSchema = z.object({ songs: z.array(songSchema).max(MAX_SONGS) });

/** 주소 조각(#srpsong=...)을 해석한다. 모양이 맞지 않으면 null. */
export function parseSongFragment(hash: string): ReadSong[] | null {
  if (!hash.startsWith(FRAGMENT_PREFIX)) return null;
  try {
    const json: unknown = JSON.parse(decodeURIComponent(hash.slice(FRAGMENT_PREFIX.length)));
    const parsed = fragmentSchema.safeParse(json);
    return parsed.success ? parsed.data.songs : null;
  } catch {
    return null;
  }
}

/** 같은 곡 줄(곡명·아티스트·채보가 모두 같음)은 한 번만 둔다. 같은 쪽을 두 번 보내도 쌓이지 않게 한다. */
export function mergeSongs(current: readonly ReadSong[], incoming: readonly ReadSong[]): ReadSong[] {
  const seen = new Set(current.map(songKey));
  const merged = [...current];
  for (const song of incoming) {
    const key = songKey(song);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(song);
    }
  }
  return merged.slice(0, MAX_SONGS);
}

function songKey(song: ReadSong): string {
  return JSON.stringify([song.title, song.artist, song.charts]);
}

export interface ArtistFill {
  songId: number;
  title: string;
  officialArtist: string;
}

export interface ArtistMismatch {
  songId: number;
  title: string;
  currentArtist: string;
  officialArtist: string;
}

export interface LevelChange {
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficultyType: DifficultyType;
  currentLevel: number;
  officialLevel: number;
}

export interface SongImportPreview {
  readSongs: number;
  matchedSongs: number;
  unchangedSongs: number;
  unmatchedCount: number;
  unmatchedTitles: string[];
  artistFills: ArtistFill[];
  artistMismatches: ArtistMismatch[];
  levelChanges: LevelChange[];
}

export interface SongImportCommitResult {
  artistFilled: number;
  levelChanged: number;
  skipped: number;
}

export function previewOfficialSongs(songs: readonly ReadSong[]): Promise<SongImportPreview> {
  return apiFetch<SongImportPreview>("/admin/song-imports/preview", { method: "POST", body: { songs } });
}

export function commitOfficialSongs(
  songs: readonly ReadSong[],
  artistSongIds: readonly number[],
  levelChartIds: readonly number[],
): Promise<SongImportCommitResult> {
  return apiFetch<SongImportCommitResult>("/admin/song-imports/commit", {
    method: "POST",
    body: { songs, artistSongIds, levelChartIds },
  });
}
