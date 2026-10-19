import { useSyncExternalStore } from "react";
import { z } from "zod";
import type { ReadPlay } from "@/lib/import-bookmarklet";
import { playKey } from "@/lib/record-import";

/**
 * 공식 페이지의 북마클릿이 넘긴 플레이를 받아 두는 곳 (D40).
 *
 * 북마클릿은 `https://사이트/import#srp=<JSON>`으로 연다. 값을 URL 조각(#)에 담는 이유: 조각은 서버로 전송되지 않아
 * 접속 기록에 남지 않고, 별도 토큰 없이 사이트 화면이 로그인 계정으로 처리할 수 있다.
 * 받은 값은 주소에서 바로 지우고(history.replaceState) 이 브라우저의 localStorage에 쌓아 둔다.
 * 저장 전의 임시 값이고 토큰·계정 정보는 들어 있지 않다. 저장(commit)이 끝난 플레이는 pending에서 뺀다.
 */

const STORAGE_KEY = "srp-import-handoff";
const FRAGMENT_PREFIX = "#srp=";
/** 오래 방치된 값은 버린다(다음 날 열었을 때 어제 값이 모달로 뜨지 않게). */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** 공식 최근 플레이는 최대 20곡이고 한 번에 5곡이다. 진행 표시는 4쪽 기준. */
export const PLAYS_PER_PAGE = 5;
export const MAX_PAGES = 4;

const playSchema = z.object({
  playedAtMs: z.number().int(),
  gameType: z.string().max(10),
  title: z.string().min(1).max(255),
  difficultyClass: z.string().min(1).max(30),
  rate: z.number().int().min(0).max(10000),
  ok: z.number().int().min(0).max(100000),
  miss: z.number().int().min(0).max(100000),
  translated: z.boolean(),
  options: z.array(z.string().max(40)).max(10),
});

const fragmentSchema = z.object({
  plays: z.array(playSchema).max(20),
  unreadable: z.number().int().min(0).optional(),
});

export interface HandoffState {
  /** 아직 저장하지 않은 플레이(중복 제거됨) */
  pending: ReadPlay[];
  /** 이번 가져오기 동안 받은 서로 다른 플레이의 키(저장 여부와 무관). 진행 표시용 */
  receivedKeys: string[];
  /** 읽지 못해 보내지 않은 항목 수(마지막 전달 기준) */
  unreadable: number;
  updatedAt: number;
}

const EMPTY: HandoffState = { pending: [], receivedKeys: [], unreadable: 0, updatedAt: 0 };

let cache: HandoffState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(): HandoffState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<HandoffState>;
    if (!parsed || typeof parsed.updatedAt !== "number" || Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      return EMPTY;
    }
    const plays = z.array(playSchema).safeParse(parsed.pending);
    if (!plays.success) return EMPTY;
    return {
      pending: plays.data,
      receivedKeys: Array.isArray(parsed.receivedKeys) ? parsed.receivedKeys.filter((k) => typeof k === "string") : [],
      unreadable: typeof parsed.unreadable === "number" ? parsed.unreadable : 0,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return EMPTY;
  }
}

function writeStorage(state: HandoffState): void {
  try {
    if (state.pending.length === 0 && state.receivedKeys.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 이 화면 안에서만 유지된다
  }
}

function set(next: HandoffState): void {
  cache = next;
  loaded = true;
  writeStorage(next);
  listeners.forEach((l) => l());
}

export function getHandoff(): HandoffState {
  if (!loaded && typeof window !== "undefined") {
    cache = readStorage();
    loaded = true;
  }
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = readStorage();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** 받은 플레이 상태를 구독한다. 서버 렌더링 중에는 빈 상태. */
export function useHandoff(): HandoffState {
  return useSyncExternalStore(subscribe, getHandoff, () => EMPTY);
}

/** 주소 조각(#srp=...)을 해석한다. 모양이 맞지 않으면 null. */
export function parseFragment(hash: string): { plays: ReadPlay[]; unreadable: number } | null {
  if (!hash.startsWith(FRAGMENT_PREFIX)) return null;
  try {
    const json: unknown = JSON.parse(decodeURIComponent(hash.slice(FRAGMENT_PREFIX.length)));
    const parsed = fragmentSchema.safeParse(json);
    if (!parsed.success) return null;
    return { plays: parsed.data.plays, unreadable: parsed.data.unreadable ?? 0 };
  } catch {
    return null;
  }
}

/** 받은 플레이를 쌓는다. 같은 플레이(시각+곡+난이도)는 한 번만 둔다. 새로 들어온 곡 수를 돌려준다. */
export function addPlays(incoming: ReadPlay[], unreadable: number): number {
  const current = getHandoff();
  const pendingKeys = new Set(current.pending.map(playKey));
  const received = new Set(current.receivedKeys);
  const pending = [...current.pending];
  let added = 0;
  for (const play of incoming) {
    const key = playKey(play);
    received.add(key);
    if (!pendingKeys.has(key)) {
      pendingKeys.add(key);
      pending.push(play);
      added += 1;
    }
  }
  set({ pending, receivedKeys: [...received], unreadable, updatedAt: Date.now() });
  return added;
}

/** 주소에 조각이 있으면 받아서 쌓고 주소에서 지운다. 받은 게 있으면 true. */
export function consumeFragment(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.location.hash.startsWith(FRAGMENT_PREFIX)) return false;
  const parsed = parseFragment(window.location.hash);
  // 조각은 해석이 되든 안 되든 먼저 주소에서 지운다(새로고침·공유로 다시 처리되지 않게)
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  if (!parsed || parsed.plays.length === 0) return false;
  addPlays(parsed.plays, parsed.unreadable);
  return true;
}

/** 저장이 끝난 플레이를 pending에서 뺀다(받은 기록 키는 남겨 진행 표시를 유지). */
export function removePlays(done: ReadPlay[]): void {
  const doneKeys = new Set(done.map(playKey));
  const current = getHandoff();
  set({ ...current, pending: current.pending.filter((p) => !doneKeys.has(playKey(p))), updatedAt: Date.now() });
}

/** 모두 비운다(취소·새로 시작). */
export function clearHandoff(): void {
  set({ ...EMPTY });
}

/** 완료한 쪽 수. 진행 표시(●●○○)용. */
export function pagesReceived(state: HandoffState): number {
  return Math.min(MAX_PAGES, Math.ceil(state.receivedKeys.length / PLAYS_PER_PAGE));
}

/** 테스트용: 메모리 캐시를 버려 저장소에서 다시 읽게 한다. */
export function resetHandoffCache(): void {
  cache = EMPTY;
  loaded = false;
}
