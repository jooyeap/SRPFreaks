import { useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";

/**
 * 재킷 표시 (D54 3단계). 설계는 docs/DESIGN.md 18.4.0-3, 화면은 DESIGN-UI 8장.
 *  - 운영 설정 `ui.show_song_images`가 켜져 있을 때만 서버가 곡 id → 재킷 주소 목록을 준다(`GET /songs/jackets`, 공개).
 *  - 개인 설정 `재킷 표시`(기본 켜짐)는 이 기기 브라우저에만 저장한다(한 손 모드와 같은 방식). 끄면 재킷 칸이 없는 예전 화면이고
 *    이미지를 불러오지 않는다.
 *  - 목록은 앱 전체에서 한 번 받아 두고(Providers의 useJacketsLoader, 10분 동안 새로 받지 않음) 곡 id로 찾아 쓴다.
 */
export interface SongJacketsResponse {
  enabled: boolean;
  jackets: Record<string, string>;
}

export const jacketKeys = { all: ["songs", "jackets"] as const };
export const JACKET_STORAGE_KEY = "srp.showJackets";

export function fetchJackets(signal?: AbortSignal): Promise<SongJacketsResponse> {
  return apiFetch<SongJacketsResponse>("/songs/jackets", { signal });
}

let current: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (current === null) {
    try {
      current = localStorage.getItem(JACKET_STORAGE_KEY) !== "0";
    } catch {
      current = true;
    }
  }
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setShowJackets(on: boolean): void {
  current = on;
  try {
    localStorage.setItem(JACKET_STORAGE_KEY, on ? "1" : "0");
  } catch {
    // 저장할 수 없어도 이번 화면에서는 켜고 끌 수 있다
  }
  listeners.forEach((listener) => listener());
}

/** 테스트용: 메모리 값을 비워서 다음 읽기에서 저장소를 다시 본다 */
export function resetShowJacketsForTest(): void {
  current = null;
  listeners.forEach((listener) => listener());
}

/** 개인 설정 `재킷 표시`. 서버 그림과 맞추려고 서버 쪽 값은 꺼짐이다(브라우저에서 바로 실제 값으로 바뀐다). */
export function useShowJacketsSetting(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/* ---------- 받은 재킷 목록(앱 전체에서 하나) ---------- */
// 목록은 Providers 안의 JacketsLoader가 TanStack Query로 한 번 받아 여기에 넣는다. 화면 조각(줄·카드)은 이 값만 읽는다.
// 왜: 줄·카드마다 쿼리를 걸면 그 조각만 그리는 테스트·화면도 서버 요청과 QueryClient가 필요해진다. 받는 곳을 한 군데로 모았다.
let jacketData: SongJacketsResponse | null = null;
const dataListeners = new Set<() => void>();

export function setJacketData(data: SongJacketsResponse | null): void {
  jacketData = data;
  dataListeners.forEach((listener) => listener());
}

function subscribeData(listener: () => void): () => void {
  dataListeners.add(listener);
  return () => {
    dataListeners.delete(listener);
  };
}

function useJacketData(): SongJacketsResponse | null {
  return useSyncExternalStore(subscribeData, () => jacketData, () => null);
}

/** Providers 안에 한 번 둔다: 재킷 목록을 받아(10분 동안 새로 받지 않음) 위 저장소에 넣는다. 그리는 것은 없다. */
export function useJacketsLoader(): void {
  const { data } = useQuery({ queryKey: jacketKeys.all, queryFn: ({ signal }) => fetchJackets(signal), staleTime: 10 * 60_000, retry: false });
  useEffect(() => {
    setJacketData(data ?? null);
  }, [data]);
}

/** 운영 설정이 켜져 있는지(설정 화면에서 `재킷 표시` 칸을 보일지 정한다). */
export function useJacketsEnabled(): boolean {
  return useJacketData()?.enabled === true;
}

/**
 * 화면이 재킷 칸을 그릴지와 곡별 주소. visible = 운영 설정 켜짐 + 개인 설정 켜짐.
 * visible이면 재킷이 없는 곡도 같은 크기의 단색 칸을 둔다(줄 높이·곡명 위치가 곡마다 같게).
 */
export function useJackets(): { visible: boolean; urlOf: (songId: number) => string | null } {
  const on = useShowJacketsSetting();
  const data = useJacketData();
  const visible = on && data?.enabled === true;
  return { visible, urlOf: (songId) => (visible ? (data?.jackets[String(songId)] ?? null) : null) };
}
