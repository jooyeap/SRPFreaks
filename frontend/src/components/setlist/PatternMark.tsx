"use client";

import { useTranslations } from "next-intl";

import { patternLabel } from "@/lib/chart-labels";

/**
 * 세트리스트·추천 줄의 속성 표시(단일 / 복합 / 이중 / 삼중). 글자 그대로 보여 주고 색으로 구분하지 않는다.
 * 글자는 서열표·레이팅 화면이 쓰는 patternLabel을 그대로 써서 문구를 따로 만들지 않는다.
 */
export function PatternMark({ pattern }: { pattern: string }) {
  const t = useTranslations();
  return (
    <span className="rounded-md border border-chip-line px-1.5 py-0.5 text-xs text-fg-sub">{patternLabel(pattern, t)}</span>
  );
}
