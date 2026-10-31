import { apiFetch } from "@/lib/api";

/** 재킷 곡명 매칭 결과(백엔드 SongJacketMatchResponse, D54). hasJacket이면 이미 재킷이 있는 곡(교체 후보). */
export interface JacketMatch {
  officialTitle: string;
  songId: number;
  songTitle: string;
  hasJacket: boolean;
}

export interface JacketMatchResponse {
  matches: JacketMatch[];
  unmatchedCount: number;
  missingSongs: { songId: number; title: string }[];
}

export interface JacketSaveResponse {
  saved: number;
  replaced: number;
}

/** 공식 곡명 목록을 마스터와 맞춘다(ROOT). 저장하지 않는다. */
export function matchJackets(titles: string[]): Promise<JacketMatchResponse> {
  return apiFetch<JacketMatchResponse>("/admin/song-jackets/match", { method: "POST", body: { titles } });
}

/** 재킷 저장(ROOT). 한 번에 10장까지, songIds와 images는 같은 순서. */
export function saveJackets(items: { songId: number; blob: Blob }[]): Promise<JacketSaveResponse> {
  const form = new FormData();
  for (const item of items) {
    form.append("songIds", String(item.songId));
    form.append("images", new File([item.blob], `${item.songId}.webp`, { type: "image/webp" }));
  }
  return apiFetch<JacketSaveResponse>("/admin/song-jackets", { method: "POST", body: form });
}
