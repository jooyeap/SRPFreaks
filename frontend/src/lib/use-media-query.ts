"use client";

import { useSyncExternalStore } from "react";

/**
 * CSS 미디어 쿼리가 맞는지 보는 훅. 서버 렌더와 matchMedia가 없는 환경(테스트)에서는 false다.
 * 화면 구성 자체가 달라져(데스크톱은 좌우 분할, 모바일은 접이식) CSS로 숨기면 같은 내용이 DOM에 두 번 들어가므로 훅으로 하나만 그린다.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** 데스크톱 폭(Tailwind lg, 1024px 이상). */
export const DESKTOP_QUERY = "(min-width: 1024px)";
