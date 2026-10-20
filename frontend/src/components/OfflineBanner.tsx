"use client";

import { useOnline } from "@/lib/online";

/**
 * 인터넷 연결이 끊기면 화면 위에 안내를 띄운다(연결되면 사라진다). 끊긴 줄 모르고 저장 버튼을 반복해서 누르는 것을 막는다.
 * 헤더 바로 아래(sticky)에 둬서 스크롤해도 보이고, 탭바·모달과 겹치지 않는다.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) {
    return null;
  }
  return (
    <p role="status" className="sticky top-0 z-30 border-b border-weak bg-card px-4 py-2 text-center text-[13px] text-weak-text">
      인터넷에 연결되어 있지 않습니다. 연결되면 다시 시도해 주세요.
    </p>
  );
}
