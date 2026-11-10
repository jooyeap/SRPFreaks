"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { goBackInApp } from "@/lib/app-history";

/**
 * "들어온 곳으로 돌아가는" 뒤로 버튼. 같은 사이트 안에서 들어왔으면 history로 한 칸 뒤로(마이페이지·곡 상세·알림 등 들어온 화면),
 * 되돌아갈 곳이 없으면(주소창 직접 진입, 새 탭) `fallbackHref`로 간다(lib/app-history.ts).
 * 보이는 것은 일반 링크 그대로다: href가 있어서 새 탭으로 열기·길게 누르기·키보드 Enter가 모두 폴백 주소로 동작하고,
 * 그냥 누를 때만 가로챈다(수정키·가운데 버튼은 건드리지 않는다). 판단은 클릭 때만 하므로 서버 렌더와 하이드레이션이 같다.
 */
export function BackLink({
  fallbackHref,
  className,
  ariaLabel,
  children,
}: {
  fallbackHref: string;
  className?: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (goBackInApp()) {
      event.preventDefault();
    }
  };
  return (
    <Link href={fallbackHref} aria-label={ariaLabel} title={ariaLabel} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
