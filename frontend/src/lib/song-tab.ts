import { useSyncExternalStore } from "react";

/**
 * 곡 메뉴가 들어갈 화면: 마지막으로 본 탭(서열표 `/table` 또는 곡 목록 `/songs`)을 이 기기에 기억한다.
 * 한 손 모드·시작 안내 숨김과 같은 방식: localStorage 한 칸 + 저장소를 못 쓸 때를 위한 메모리 값. 처음(기억 없음)은 서열표다.
 * 저장하는 것은 두 값 중 하나뿐이라 외부 입력이 주소로 새어 들어갈 수 없다(읽을 때도 두 값만 받는다).
 */
export type SongTab = "table" | "songs";
export const SONG_TAB_KEY = "srp.songTab";
const DEFAULT_TAB: SongTab = "table";

let current: SongTab | null = null;
const listeners = new Set<() => void>();

function read(): SongTab {
  if (current === null) {
    try {
      const saved = localStorage.getItem(SONG_TAB_KEY);
      current = saved === "songs" || saved === "table" ? saved : DEFAULT_TAB;
    } catch {
      current = DEFAULT_TAB;
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

/** 곡 화면에 들어올 때마다 호출한다. 같은 값이면 아무것도 하지 않는다. */
export function rememberSongTab(tab: SongTab): void {
  if (read() === tab) {
    return;
  }
  current = tab;
  try {
    localStorage.setItem(SONG_TAB_KEY, tab);
  } catch {
    // 저장할 수 없어도 이번 화면에서는 기억된다
  }
  listeners.forEach((listener) => listener());
}

/** 테스트용: 메모리 값을 비워서 다음 읽기에서 저장소를 다시 본다 */
export function resetSongTabForTest(): void {
  current = null;
  listeners.forEach((listener) => listener());
}

/** `곡` 메뉴가 가야 할 주소. 서버 렌더링 값은 기본(서열표)이고 브라우저에서 바로 기억한 값으로 바뀐다. */
export function useSongHomeHref(): string {
  const tab = useSyncExternalStore(subscribe, read, () => DEFAULT_TAB);
  return `/${tab}`;
}
