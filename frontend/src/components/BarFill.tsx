"use client";

import type { CSSProperties, ReactNode } from "react";
import { barFill } from "@/lib/motion";
import { useFirstAppearance } from "@/lib/use-first-appearance";

/**
 * 채움 막대 한 칸(D82, 모션 PR 5). 폭(`width`)은 호출하는 쪽이 `style`로 정하고, 이 컴포넌트는 처음 나타날 때 한 번만 왼쪽에서 오른쪽으로(`rtl`이면 반대) clip-path가 열리게 한다.
 * 폭 자체는 처음부터 최종 값이라 레이아웃이 바뀌지 않고(clip-path는 배치에 영향이 없다), 글자·aria는 건드리지 않는다.
 * `motionKey`는 막대를 구분하는 글자(다시 마운트돼도 재생하지 않게 기억한다, lib/use-first-appearance.ts). 비어 있으면 모션이 없다.
 * `index`는 목록 안 번호(8번째부터는 움직이지 않는다). 값이 아직 없는 자리(불러오는 중)에는 막대를 그리지 않는 쪽에서 이 컴포넌트를 부르지 않는다.
 */
export function BarFill({
  motionKey,
  index,
  rtl = false,
  decorative = false,
  as: Tag = "span",
  className = "",
  style,
  children,
}: {
  motionKey?: string;
  index?: number;
  rtl?: boolean;
  /** 장식 막대(값은 옆 글자가 전한다)면 true: aria-hidden */
  decorative?: boolean;
  as?: "span" | "div";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const first = useFirstAppearance(motionKey);
  const fill = barFill(first, index, rtl);
  return (
    <Tag aria-hidden={decorative ? true : undefined} className={`${className} ${fill.className}`.trim()} style={fill.style ? { ...style, ...fill.style } : style}>
      {children}
    </Tag>
  );
}
