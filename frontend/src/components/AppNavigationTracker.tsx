"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { noteAppNavigation } from "@/lib/app-history";

/**
 * 앱 안에서 화면 주소(pathname)가 바뀐 횟수를 센다(lib/app-history.ts의 폴백 판단용). 그리는 것은 없다.
 * 처음 그릴 때의 주소는 세지 않고, 쿼리만 바뀌는 replace(탭·차트 전환)는 pathname이 같아서 세지 않는다.
 * 이전 주소를 ref에 두고 비교하므로 개발 모드의 effect 이중 실행(Strict Mode)에도 잘못 세지 않는다.
 */
export function AppNavigationTracker() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current !== pathname) {
      previous.current = pathname;
      noteAppNavigation();
    }
  }, [pathname]);
  return null;
}
