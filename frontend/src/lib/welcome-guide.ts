import { useSyncExternalStore } from "react";

/**
 * 홈의 `시작하기` 안내를 사용자가 숨겼는지(이 기기 설정). 한 손 모드와 같은 방식으로 localStorage 한 칸만 쓰고,
 * 저장소를 못 쓰는 환경에서도 이번 화면에서는 숨길 수 있게 메모리 값을 먼저 둔다. 토큰 같은 민감한 값은 저장하지 않는다.
 * 기록이 생기면(레이팅 목록이 비어 있지 않으면) 숨기지 않았어도 안내는 저절로 사라진다(HomeDashboard가 판단).
 */
export const WELCOME_HIDDEN_KEY = "srp.welcomeHidden";

let hidden: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (hidden === null) {
    try {
      hidden = localStorage.getItem(WELCOME_HIDDEN_KEY) === "1";
    } catch {
      hidden = false;
    }
  }
  return hidden;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hideWelcomeGuide(): void {
  hidden = true;
  try {
    localStorage.setItem(WELCOME_HIDDEN_KEY, "1");
  } catch {
    // 저장할 수 없어도 이번 화면에서는 숨겨진다
  }
  listeners.forEach((listener) => listener());
}

/** 테스트용: 메모리 값을 비워서 다음 읽기에서 저장소를 다시 본다 */
export function resetWelcomeGuideForTest(): void {
  hidden = null;
  listeners.forEach((listener) => listener());
}

/** 서버 렌더링 결과와 맞추려고 서버 쪽 값은 항상 "숨기지 않음"이다. */
export function useWelcomeHidden(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
