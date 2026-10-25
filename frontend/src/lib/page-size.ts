import { useCallback, useSyncExternalStore } from "react";

/**
 * 목록 한 번에 보이는 개수(10 / 20 / 50개씩)를 기억한다.
 *
 * 어디에 두는가: 이 탭의 sessionStorage + 메모리 (lib/open-keys.ts와 같은 방식). 탭을 닫으면 사라지고 서버에는 보내지 않는다.
 * 저장소를 못 쓰는 환경에서는 메모리에만 남아서 화면 이동으로는 유지되고 새로고침하면 기본값으로 돌아간다.
 * 읽을 때 허용된 값 목록(options)에 없으면 버린다(바깥에서 바뀐 값이 서버 최대값을 넘기지 못하게). 서버도 최대값을 따로 검증한다.
 *
 * 왜 useSyncExternalStore인가: 서버 렌더링에서는 sessionStorage가 없어 기본값을 그리는데, 클라이언트 첫 렌더가 저장된 값이면
 * 글자가 서로 달라 hydration 경고가 난다. 이 훅은 서버 스냅샷을 기본값으로 고정해서 어긋남을 막는다.
 */
const STORAGE_PREFIX = "srp.pagesize.";

export type PageSizeScope =
  | "songs"
  | "players"
  | "notices"
  | "suggestions"
  | "adminSuggestions"
  | "adminUsers"
  | "auditLogs";

/** 모든 목록이 기본으로 고를 수 있는 개수. 서버 최대값(대부분 50, 관리자 화면은 100)보다 작게 둔다. */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const memory = new Map<PageSizeScope, number>();
const listeners = new Set<() => void>();

export function readPageSize(scope: PageSizeScope, fallback: number, options: readonly number[]): number {
  let value = memory.get(scope);
  if (value === undefined) {
    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + scope);
      const parsed = raw === null ? Number.NaN : Number(raw);
      if (Number.isInteger(parsed)) {
        value = parsed;
        memory.set(scope, parsed);
      }
    } catch {
      // 저장소를 못 읽으면 기본값을 쓴다
    }
  }
  return value !== undefined && options.includes(value) ? value : fallback;
}

export function writePageSize(scope: PageSizeScope, size: number): void {
  memory.set(scope, size);
  try {
    sessionStorage.setItem(STORAGE_PREFIX + scope, String(size));
  } catch {
    // 저장할 수 없어도 이번 탭의 화면 이동에서는 메모리 값으로 유지된다
  }
  listeners.forEach((listener) => listener());
}

/** 테스트용: 메모리 값을 비워서 다음 읽기에서 저장소를 다시 본다 */
export function resetPageSizeForTest(): void {
  memory.clear();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 고른 개수와 바꾸는 함수. 허용 값 밖이면 기본값(fallback)을 쓴다. */
export function usePageSize(
  scope: PageSizeScope,
  fallback: number,
  options: readonly number[] = DEFAULT_PAGE_SIZE_OPTIONS,
): readonly [number, (size: number) => void] {
  const size = useSyncExternalStore(
    subscribe,
    () => readPageSize(scope, fallback, options),
    () => fallback,
  );
  const setSize = useCallback(
    (next: number) => {
      if (options.includes(next)) {
        writePageSize(scope, next);
      }
    },
    [scope, options],
  );
  return [size, setSize] as const;
}
