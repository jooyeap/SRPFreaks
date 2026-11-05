"use client";

import { useRef } from "react";
import type { TouchEvent } from "react";
import { judgeSwipe, type SwipeDirection } from "@/lib/folder-nav";

/** 스와이프를 시작해도 되는 자리가 아닌 곳: 글자를 입력하는 칸(커서·선택을 끌 수 있다) */
const NO_SWIPE_SELECTOR = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

/**
 * target에서 boundary까지 올라가며 가로로 스크롤되는 영역(내용이 넘치고 overflow-x가 auto/scroll)이 있는지 본다.
 * 그런 영역 위에서 쓸면 그 영역의 스크롤이 먼저이므로 이웃 이동으로 보지 않는다(난이도 칩 띠 등).
 */
export function inHorizontalScroller(target: EventTarget | null, boundary: Element): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== boundary) {
    if (el.scrollWidth > el.clientWidth) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * 좌우 스와이프 감지(터치만). 반환값을 스와이프 영역 요소에 펼쳐 쓴다. 영역에는 CSS `touch-action: pan-y`(Tailwind `touch-pan-y`)를 같이 둔다:
 * 세로 스크롤은 브라우저가 그대로 하고, 가로 움직임만 이쪽으로 온다.
 * 이동 판정은 judgeSwipe(가로가 세로보다 크고 60px 이상)다. 손가락이 둘 이상이면(확대 등) 무시한다.
 */
export function useSwipeNav({ onSwipe, enabled = true }: { onSwipe: (direction: SwipeDirection) => void; enabled?: boolean }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart(e: TouchEvent<HTMLElement>) {
      start.current = null;
      if (!enabled || e.touches.length !== 1) return;
      const target = e.target;
      if (target instanceof Element && target.closest(NO_SWIPE_SELECTOR)) return;
      if (inHorizontalScroller(target, e.currentTarget)) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd(e: TouchEvent<HTMLElement>) {
      const from = start.current;
      start.current = null;
      const end = e.changedTouches[0];
      if (!from || !end) return;
      const direction = judgeSwipe(end.clientX - from.x, end.clientY - from.y);
      if (direction) onSwipe(direction);
    },
    onTouchCancel() {
      start.current = null;
    },
  };
}
