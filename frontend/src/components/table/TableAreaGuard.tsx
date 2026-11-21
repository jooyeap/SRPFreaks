"use client";

import { useEffect } from "react";
import { resetFilterNoticeShown } from "@/lib/folder-filter-carry";

/**
 * 서열표 영역(`/table` 이하)을 벗어나면 "필터 이어가기 안내를 이미 보여 줬다"는 기억을 지운다(D99).
 * app/table/layout.tsx는 /table 아래 화면을 오가는 동안 계속 살아 있고, 홈·곡·마이페이지로 나가면 사라지므로 이 컴포넌트의 정리(cleanup)가 "영역을 벗어남"의 신호다.
 * 개발 모드(StrictMode)의 마운트-정리-마운트에서도 마운트 직후라 지울 것이 없어 영향이 없다.
 */
export function TableAreaGuard() {
  useEffect(() => resetFilterNoticeShown, []);
  return null;
}
