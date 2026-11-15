"use client";

import { useEffect, useRef, useState } from "react";

/** globals.css의 --motion-slow(240ms)와 같은 값. 닫는 동안 내용을 남겨 두는 시간이다. 값을 바꾸면 CSS 토큰과 함께 바꾼다(motion.test.ts가 비교) */
export const COLLAPSE_MS = 240;
/** 모션이 끝난 뒤 상태를 정리할 때까지 기다리는 시간(여유 30ms) */
const SETTLE_MS = COLLAPSE_MS + 30;

/** closed: 내용 없음 / opening: 펼치는 중 / open: 다 펼침. 닫는 중은 따로 두지 않는다(open=false인데 phase가 아직 closed가 아닌 구간이 닫는 중이다) */
type Phase = "closed" | "opening" | "open";

export type CollapseState = {
  /** 내용을 그려야 하는가. 열려 있거나, 닫히는 모션이 끝나기 전이면 true */
  rendered: boolean;
  /** 높이가 펼쳐진 상태(CSS: grid-template-rows 1fr)로 둘 것인가 */
  expanded: boolean;
  /** 모션 중이라 안쪽을 잘라야(overflow hidden) 하는가. 다 펼쳐진 뒤에는 false라 포커스 링·팝오버가 잘리지 않는다 */
  clip: boolean;
};

function prefersReducedMotion(): boolean {
  // matchMedia가 없는 환경(테스트 등)은 모션 없이 바로 바꾼다
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 접기/펼치기 모션(D82, 모션 PR 3)의 상태. 높이를 직접 재지 않고 `grid-template-rows: 0fr ↔ 1fr` 전환을 쓰므로
 * 이 훅은 "언제 내용을 그리고, 언제 펼친 상태로 두고, 언제 잘라야 하는지"만 정한다.
 *  - 열기: 먼저 0fr로 그린 뒤 두 프레임 뒤에 1fr로 바꿔 전환이 걸리게 한다(같은 프레임에 바꾸면 전환 없이 점프한다).
 *  - 닫기: 0fr로 바꾸면서 내용은 모션이 끝날 때까지 남긴 뒤 지운다(안 지우면 긴 목록이 계속 DOM에 남아 느려진다).
 *  - 처음부터 열려 있는 경우(화면 진입, 뒤로 와서 복원)는 모션 없이 바로 펼친 상태다. 스크롤 위치 복원에 영향을 주지 않는다.
 *  - 움직임 줄이기 설정이면 모션 없이 바로 바뀐다(이전 동작과 같다).
 */
export function useCollapse(open: boolean): CollapseState {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  const prevOpen = useRef(open);

  useEffect(() => {
    if (prevOpen.current === open) return;
    prevOpen.current = open;
    let raf1 = 0;
    let raf2 = 0;
    // 상태 변경은 모두 콜백 안에서 한다(effect 본문에서 바로 setState 하면 연쇄 렌더가 생긴다)
    if (prefersReducedMotion()) {
      const t0 = window.setTimeout(() => setPhase(open ? "open" : "closed"), 0);
      return () => window.clearTimeout(t0);
    }
    let timer = 0;
    if (open) {
      // 두 프레임 기다린다: 0fr로 한 번 그려진 뒤에 1fr로 바뀌어야 전환이 시작된다
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setPhase("opening"));
      });
      timer = window.setTimeout(() => setPhase("open"), SETTLE_MS + 34);
    } else {
      timer = window.setTimeout(() => setPhase("closed"), SETTLE_MS);
    }
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [open]);

  if (prefersReducedMotion()) {
    return { rendered: open, expanded: open, clip: false };
  }
  const rendered = open || phase !== "closed";
  const expanded = open && (phase === "opening" || phase === "open");
  return { rendered, expanded, clip: !(open && phase === "open") };
}
