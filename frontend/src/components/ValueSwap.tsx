"use client";

import type { ReactNode } from "react";
import { useValueChangeCount } from "@/lib/use-value-change";

/**
 * 숫자 바뀜 모션(D82, 모션 PR 5). 카운트업 대신, 값이 바뀌면 새 값이 4px 아래에서 올라오며 나타난다(`motion-value-swap`).
 * 처음 그릴 때와 불러오는 중 → 불러옴에는 재생하지 않고, 이미 있던 값이 다른 값으로 바뀔 때만 한 번 재생한다(lib/use-value-change.ts).
 * 글자는 처음부터 최종 값이라 선택·복사·읽기 프로그램에 영향이 없고 aria도 건드리지 않는다. 움직임 줄이기에서는 CSS가 끈다.
 * 티어 색 글자(`.tier-score`)처럼 글자 모양으로 오려 쓰는 요소는 안쪽에 두고 이 래퍼가 움직인다(오려 쓴 배경의 반짝임과 겹치지 않게).
 */
export function ValueSwap({
  value,
  as: Tag = "span",
  className = "",
  children,
}: {
  value: string | number | null | undefined;
  as?: "span" | "div";
  className?: string;
  children: ReactNode;
}) {
  const changes = useValueChangeCount(value);
  return (
    <Tag key={changes} data-value-swap={changes > 0 ? "" : undefined} className={`${changes > 0 ? "motion-value-swap" : ""} ${className}`.trim() || undefined}>
      {children}
    </Tag>
  );
}
