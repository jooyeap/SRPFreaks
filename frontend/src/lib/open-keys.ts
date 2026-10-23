import { useCallback, useState } from "react";

/**
 * 펼친 폴더(서열표 묶음, 곡 목록 레벨 폴더)를 기억한다.
 *
 * 왜 필요한가: 폴더를 펼쳐 둔 상태는 컴포넌트 안의 임시 상태(useState)라서, 곡 상세로 갔다가 뒤로 오면
 * 컴포넌트가 새로 만들어지며 모두 닫힌다. 필터·정렬·페이지는 주소(쿼리)에 있어 남지만 이 값은 주소에 두기엔 길다.
 *
 * 어디에 두는가: 이 탭의 sessionStorage + 메모리. 탭을 닫으면 사라지고 다른 탭과 섞이지 않는다.
 * 저장하는 것은 "펼친 폴더의 이름표 목록"뿐이다(토큰·개인정보 없음). 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는
 * 메모리에만 남아서, 화면 이동으로는 유지되고 새로고침하면 사라진다.
 * 읽을 때 문자열 배열이 아니거나 너무 많으면 버린다(바깥에서 바뀐 값이 화면을 깨지 못하게).
 */
const STORAGE_PREFIX = "srp.open.";
const MAX_KEYS = 500;

export type OpenScope = "table" | "songs";

const memory = new Map<OpenScope, ReadonlySet<string>>();

export function readOpenKeys(scope: OpenScope): ReadonlySet<string> {
  const cached = memory.get(scope);
  if (cached) {
    return cached;
  }
  let keys: ReadonlySet<string> = new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + scope);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length <= MAX_KEYS && parsed.every((k) => typeof k === "string")) {
      keys = new Set(parsed as string[]);
    }
  } catch {
    // 저장소를 못 읽거나 값이 깨져 있으면 모두 닫힌 상태로 시작한다
  }
  memory.set(scope, keys);
  return keys;
}

export function writeOpenKeys(scope: OpenScope, keys: ReadonlySet<string>): void {
  const limited = new Set([...keys].slice(0, MAX_KEYS));
  memory.set(scope, limited);
  try {
    sessionStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify([...limited]));
  } catch {
    // 저장할 수 없어도 이번 탭의 화면 이동에서는 메모리 값으로 유지된다
  }
}

/** 테스트용: 메모리 값을 비워서 다음 읽기에서 저장소를 다시 본다 */
export function resetOpenKeysForTest(): void {
  memory.clear();
}

/**
 * 펼친 폴더 이름표 집합과 바꾸는 함수. 처음 값은 기억해 둔 것(없으면 모두 닫힘)이다.
 * 이 훅을 쓰는 컴포넌트는 데이터를 받은 뒤에야 그려지므로(서버 렌더링에는 폴더가 없다) 처음 값이 서버와 달라도 어긋나지 않는다.
 */
export function useOpenKeys(scope: OpenScope) {
  const [keys, setKeys] = useState<ReadonlySet<string>>(() => readOpenKeys(scope));

  const setOpen = useCallback(
    (key: string, open: boolean) => {
      const next = new Set(keys);
      if (open) next.add(key);
      else next.delete(key);
      writeOpenKeys(scope, next);
      setKeys(next);
    },
    [keys, scope],
  );

  const replaceAll = useCallback(
    (next: Iterable<string>) => {
      const set = new Set(next);
      writeOpenKeys(scope, set);
      setKeys(set);
    },
    [scope],
  );

  return { keys, setOpen, replaceAll };
}
