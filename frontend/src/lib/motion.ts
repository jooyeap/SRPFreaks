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

/** 막대 채움 모션(D82, 모션 PR 5)을 적용할 막대 수. 목록에 막대가 많아도 처음 8개까지만 움직여 느려지지 않는다(줄 순차 등장과 같은 한도) */
export const BAR_LIMIT = 8;

/**
 * 막대 하나에 붙일 채움 모션 속성. `first`는 useFirstAppearance(키)의 결과(처음 나타나는 막대인가), `index`는 목록 안 번호(0부터, 목록이 아니면 생략)다.
 * 처음 나타나는 막대이고 번호가 한도 안일 때만 `motion-bar-fill`(왼쪽에서 오른쪽으로 clip-path가 열림)을 붙이고, 번호마다 50ms씩 늦게 시작한다.
 * `rtl`은 오른쪽에서 왼쪽으로 채우는 막대(라이벌 비교의 왼쪽 반)다. 값을 아직 모르는 자리(불러오는 중)에는 막대 자체를 그리지 않으므로 여기서 다루지 않는다.
 * 끝난 뒤에는 clip-path가 남지 않는다(fill-mode backwards).
 */
export function barFill(first: boolean, index?: number, rtl = false): { className: string; style: CSSProperties | undefined } {
  if (!first || (index !== undefined && (index < 0 || index >= BAR_LIMIT))) return { className: "", style: undefined };
  return {
    className: rtl ? "motion-bar-fill motion-bar-fill-rtl" : "motion-bar-fill",
    style: index ? ({ "--bar-i": index } as CSSProperties) : undefined,
  };
}
