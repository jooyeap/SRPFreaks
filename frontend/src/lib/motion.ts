import type { CSSProperties } from "react";

/** 목록 줄이 차례로 나타나는 모션(D82, 모션 PR 3)을 적용할 줄 수. 줄이 많아도 처음 8줄까지만 움직여 느려지지 않는다 */
export const STAGGER_LIMIT = 8;

/**
 * 목록 줄 하나에 붙일 등장 모션 속성. 줄 번호(0부터)가 STAGGER_LIMIT 이상이면 아무것도 붙이지 않는다(`더 보기`로 이어 붙는 줄도 움직이지 않는다).
 * 모션은 줄이 새로 그려질 때 한 번만 재생되는 CSS 애니메이션이라, 같은 줄이 다시 그려지거나(refetch) 스크롤해도 다시 재생되지 않는다.
 * 사용: `const s = stagger(i);` → `<li className={`... ${s.className}`} style={s.style}>`
 */
export function stagger(index: number | undefined): { className: string; style: CSSProperties | undefined } {
  if (index === undefined || index < 0 || index >= STAGGER_LIMIT) return { className: "", style: undefined };
  return { className: "motion-stagger", style: { "--stagger-i": index } as CSSProperties };
}
