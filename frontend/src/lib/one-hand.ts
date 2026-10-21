import { useSyncExternalStore } from "react";

/**
 * 한 손 입력 모드 (게임장에서 한 손으로 기록을 넣을 때): 기록 창의 달성률을 큰 숫자 패드로 입력하고 풀콤보를 큰 버튼으로 켠다.
 * 켜짐/꺼짐은 이 기기의 화면 설정이라 localStorage에 한 칸만 저장한다(테마와 같은 종류. 토큰 같은 민감한 값은 저장하지 않는다).
 * 저장소를 못 쓰는 환경(비공개 창, 차단)에서도 토글이 동작하도록 메모리 값을 먼저 두고, 저장은 가능할 때만 한다.
 */
export const ONE_HAND_STORAGE_KEY = "srp.oneHandMode";

let current: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (current === null) {
    try {
      current = localStorage.getItem(ONE_HAND_STORAGE_KEY) === "1";
    } catch {
      current = false;
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

export function setOneHandMode(on: boolean): void {
  current = on;
  try {
    localStorage.setItem(ONE_HAND_STORAGE_KEY, on ? "1" : "0");
  } catch {
    // 저장할 수 없어도 이번 화면에서는 켜고 끌 수 있다
  }
  listeners.forEach((listener) => listener());
}

/** 테스트용: 메모리 값을 비워서 다음 읽기에서 저장소를 다시 본다 */
export function resetOneHandModeForTest(): void {
  current = null;
  listeners.forEach((listener) => listener());
}

/** 서버 렌더링 결과와 맞추려고 서버 쪽 값은 항상 꺼짐이다(브라우저에서 바로 실제 값으로 바뀐다). */
export function useOneHandMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export type PadKey = "0" | "00" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "back";

/**
 * 숫자 패드 한 번 누름을 달성률 입력 글자(소수점 없는 정수 0~10000)에 반영한다. 소수점은 저장할 때 자동으로 찍힌다(9971 → 99.71).
 * 범위는 폼·서버 검사와 같고(최종 검사는 저장할 때 Zod가 다시 한다), 넣을 수 없는 키는 글자를 그대로 돌려준다.
 *  - 첫 글자가 0이면 다음 숫자가 그 자리를 대신한다("0" + "5" → "5"). 0이나 빈 칸에서 `00`은 "0"으로 둔다.
 *  - 10000을 넘는 값은 만들 수 없다("10001"은 막힘, "10000"은 100.00).
 */
export function padInput(current: string, key: PadKey): string {
  if (key === "back") {
    return current.slice(0, -1);
  }
  const next = current === "" || current === "0" ? (key === "00" ? "0" : key) : current + key;
  return Number(next) > 10000 ? current : next;
}
