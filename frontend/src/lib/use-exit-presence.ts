"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";

/** globals.css의 --motion-base(180ms)와 같은 값. 창·말풍선·토스트가 닫히는 동안 화면에 남겨 두는 시간이다. 값을 바꾸면 CSS 토큰과 함께 바꾼다(motion.test.ts가 비교) */
export const EXIT_MS = 180;
/** globals.css의 --motion-fast(120ms)와 같은 값. 도움말 상자·토스트가 사라지는 시간 */
export const EXIT_FAST_MS = 120;
/** globals.css의 --motion-slow(240ms)와 같은 값. 아래로 내려가는 시트가 닫히는 시간 */
export const EXIT_SHEET_MS = 240;
/** 애니메이션이 끝난 마지막 프레임까지 확실히 보이도록 두는 여유 */
const SETTLE_MS = 20;

export function prefersReducedMotion(): boolean {
  // matchMedia가 없는 환경(테스트 등)은 모션 없이 바로 바꾼다
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type ExitPresence = {
  /** 화면에 그려야 하는가. 열려 있거나, 닫히는 모션이 끝나기 전이면 true. 닫힌 뒤에는 false라 DOM에서 사라진다(클릭을 가로채지 않는다) */
  present: boolean;
  /** 닫히는 모션이 재생 중인가(open은 이미 false). CSS가 `data-closing="true"`로 받아 나가는 모션을 건다 */
  closing: boolean;
  /**
   * `<dialog>`에 펼쳐 쓰는 속성. `data-closing`은 나가는 모션용이고, `onCancel`은 Esc(브라우저가 창을 바로 닫아 버리는 동작)를
   * 막고 `onRequestClose`를 대신 불러서 같은 닫힘 모션을 거치게 한다. 이미 닫히는 중이면 Esc는 무시한다(두 번 닫기 방지).
   */
  dialogProps: { "data-closing": "true" | undefined; onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void };
};

/**
 * 닫힘 모션(D82, 모션 PR 4)의 "닫는 중" 상태. D57에서는 닫히면 바로 DOM에서 지웠지만, 이제는 `open`이 false가 된 뒤에도
 * `ms` 동안 `present`를 true로 두어 CSS의 나가는 모션이 재생되게 하고, 끝나면 지운다.
 *  - 열고 닫는 판단(뒤로 가기 history 칸, 포커스 되돌리기, 이동 후 정리)은 모두 `open`을 기준으로 그대로 둔다. 이 훅은 "화면에서 언제 지울까"만 정한다.
 *  - 닫는 중에 다시 열리면(open → true) 타이머를 취소하고 열린 상태로 돌아간다.
 *  - 움직임 줄이기 설정(또는 matchMedia가 없는 환경)에서는 `present === open`이라 예전처럼 바로 사라진다.
 *  - `open`이 바뀐 그 렌더에서 바로 `exiting`을 켠다(렌더 중 setState). effect에서 켜면 한 프레임 동안 present가 false가 되어 깜빡인다.
 */
export function useExitPresence(open: boolean, options?: { ms?: number; onRequestClose?: () => void }): ExitPresence {
  const ms = options?.ms ?? EXIT_MS;
  const [prevOpen, setPrevOpen] = useState(open);
  const [exiting, setExiting] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setExiting(!open && !prefersReducedMotion());
  }

  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(() => setExiting(false), ms + SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [exiting, ms]);

  const requestRef = useRef(options?.onRequestClose);
  useEffect(() => {
    requestRef.current = options?.onRequestClose;
  });
  const closing = !open && exiting;
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (!closing) requestRef.current?.();
  };
  return { present: open || exiting, closing, dialogProps: { "data-closing": closing ? "true" : undefined, onCancel } };
}

function shallowEqual(a: object, b: object): boolean {
  const ak = Object.keys(a) as (keyof typeof a)[];
  const bk = Object.keys(b);
  return ak.length === bk.length && ak.every((key) => Object.is(a[key], (b as typeof a)[key]));
}

/**
 * 열려 있는 동안의 값을 붙잡아 둔다. 닫히는 모션 중에 부모가 이미 값을 비운 경우(`target`이 null, 문구가 빈 글자)에도
 * 창 안의 내용이 마지막으로 열려 있던 모양 그대로 나가게 한다. `open`이면 지금 값, 아니면 마지막으로 열려 있던 때의 값이다.
 * 얕은 비교로 바뀐 때만 저장하므로 매 렌더 새로 만드는 객체를 줘도 괜찮지만, **값 안에 매 렌더 새로 만드는 함수를 넣으면 안 된다**(비교가 늘 달라 무한 렌더가 된다). 글자·숫자·불리언만 넣는다.
 */
export function useHeldWhileOpen<T extends object>(open: boolean, value: T): T {
  const [held, setHeld] = useState(value);
  if (open && !shallowEqual(held, value)) setHeld(value);
  return open ? value : held;
}
