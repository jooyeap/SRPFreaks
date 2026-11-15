"use client";

import { useState } from "react";

/**
 * 스켈레톤이 보였다가 본문으로 바뀌는 자리에 붙일 클래스(D82, 모션 PR 6). `loading`은 지금 스켈레톤을 보여 주는 중인지다.
 * 이 컴포넌트가 스켈레톤을 한 번이라도 보여 줬으면 `motion-content-in`(본문이 서서히 나타남), 처음부터 본문이었으면(캐시가 있어 바로 그림) 빈 글자를 돌려준다.
 * 클래스는 본문 요소가 새로 그려질 때 한 번 재생되는 CSS 애니메이션이라 refetch·리렌더로 다시 재생되지 않는다.
 * 렌더 중 setState는 "이전 렌더와 비교해 상태를 맞추는" 공식 패턴이고, 같은 렌더에서 곧바로 다시 그려 깜빡임이 없다.
 */
export function useSkeletonFade(loading: boolean): string {
  const [showedSkeleton, setShowedSkeleton] = useState(loading);
  if (loading && !showedSkeleton) setShowedSkeleton(true);
  return showedSkeleton && !loading ? "motion-content-in" : "";
}
