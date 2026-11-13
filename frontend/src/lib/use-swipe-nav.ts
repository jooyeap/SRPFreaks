"use client";

import { useRef } from "react";
import type { TouchEvent } from "react";
import { judgeSwipe, type SwipeDirection, type SwipeRules } from "@/lib/folder-nav";

/** 쓸기의 방향(가로/세로)을 정하는 첫 이동량(px). 이만큼 움직이기 전에는 어느 쪽인지 정하지 않는다 */
export const SWIPE_LOCK_PX = 10;

/** 쓸기 도중 페이지가 이만큼(px) 이상 스크롤되면 이번 쓸기는 이동으로 보지 않는다 */
export const SWIPE_SCROLL_CANCEL_PX = 2;

type Lock = "pending" | "horizontal" | "vertical";

interface Gesture {
  x: number;
  y: number;
  scrollY: number;
  lock: Lock;
  /** 가로로 잠긴 뒤 onDrag를 부르기 시작했는가(이 쓸기의 끝에서 onDragEnd를 불러야 한다) */
  dragging: boolean;
}

/** (dx, dy)가 "가로로 쓸기"인가: 규칙에 각도가 있으면 가로축에서 그 각도 이내, 없으면 가로가 세로보다 큼 */
function isHorizontal(dx: number, dy: number, rules?: SwipeRules): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (rules?.maxAngleDeg !== undefined) return ay <= ax * Math.tan((rules.maxAngleDeg * Math.PI) / 180);
  return ax > ay;
}


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
 * 이동 판정은 judgeSwipe다(기본: 가로가 세로보다 크고 60px 이상. rules를 주면 그 규칙). 손가락이 둘 이상이면(확대 등) 무시한다.
 *
 * D68 오작동 방지(곡 상세와 서열표 폴더가 함께 쓴다):
 *  - 방향 잠금: 손가락이 처음 10px 넘게 움직였을 때 방향을 정한다. 가로(규칙의 각도 이내)면 가로 잠금, 아니면 세로 잠금.
 *    세로로 잠긴 쓸기는 손가락을 뗄 때까지 무시한다: 세로로 스크롤하다 엄지가 가로로 휘어도(특히 iOS는 스크롤 중에도 touchmove가 끝까지 온다) 이동으로 보지 않는다.
 *    예전에는 뗄 때 시작점~끝점 거리만 봐서 이 경우가 이동으로 오인됐다.
 *  - 스크롤 취소: 쓸기 시작 때의 window.scrollY가 도중에 2px 이상 바뀌면 이번 쓸기는 이동하지 않는다(페이지가 스크롤된 것이다).
 *  - touchmove가 한 번도 오지 않은 쓸기(시작→끝만 있는 경우, 테스트·일부 환경)는 예전처럼 끝 판정만 한다.
 *
 * 끌기 모션(선택): onDrag/onDragEnd를 주면 가로로 잠긴 뒤부터 손가락 이동량(dx, 시작점 기준)을 onDrag로 알린다.
 * 놓았을 때 이동이 인정되면 onDragEnd(방향), 아니면 onDragEnd(null)을 부르고 onSwipe는 부르지 않는다(애니메이션 뒤에 이동하려고).
 * 끌기를 시작하지 않은 쓸기는 인정되면 onSwipe를 바로 부른다. 곡 상세는 onDrag를 주지 않아 모션 없이 예전처럼 바로 이동한다.
 */
export function useSwipeNav({
  onSwipe,
  enabled = true,
  rules,
  isBlocked,
  ignoreSelector,
  onDrag,
  onDragEnd,
}: {
  onSwipe: (direction: SwipeDirection) => void;
  enabled?: boolean;
  /** 판정 규칙. 안 주면 기본 규칙(judgeSwipe). 곡 상세는 DETAIL_SWIPE_RULES, 서열표 폴더는 FOLDER_SWIPE_RULES를 준다 */
  rules?: SwipeRules;
  /** 시작할 때마다 불러서 true면 이번 쓸기를 무시한다(열려 있는 창 등, 렌더 사이에 바뀌는 상태 확인용) */
  isBlocked?: () => boolean;
  /** 기본 입력 칸 선택자에 더해, 이 선택자에 맞는 요소 안에서 시작한 쓸기도 무시한다(예: 열려 있는 창 `dialog`) */
  ignoreSelector?: string;
  /** 가로로 잠긴 뒤 손가락이 움직일 때마다 호출. dx는 시작점 기준 가로 이동량(px, 왼쪽이 음수). state를 갱신하지 말고 ref로 그리는 데 쓴다 */
  onDrag?: (dx: number) => void;
  /** 끌기를 시작한 쓸기가 끝났을 때. 이동이 인정되면 방향, 아니면(짧음·비낀 각도·스크롤됨·취소) null */
  onDragEnd?: (direction: SwipeDirection | null) => void;
}) {
  const gesture = useRef<Gesture | null>(null);

  function cancel(g: Gesture) {
    if (g.dragging) onDragEnd?.(null);
    g.lock = "vertical";
    g.dragging = false;
  }

  return {
    onTouchStart(e: TouchEvent<HTMLElement>) {
      gesture.current = null;
      if (!enabled || e.touches.length !== 1) return;
      const target = e.target;
      if (target instanceof Element && target.closest(ignoreSelector ? `${NO_SWIPE_SELECTOR}, ${ignoreSelector}` : NO_SWIPE_SELECTOR)) return;
      if (inHorizontalScroller(target, e.currentTarget)) return;
      if (isBlocked?.()) return;
      const x = e.touches[0].clientX;
      // 화면 좌우 가장자리에서 시작한 쓸기는 브라우저 제스처의 몫이다
      if (rules?.edgePx !== undefined && (x < rules.edgePx || x > window.innerWidth - rules.edgePx)) return;
      gesture.current = { x, y: e.touches[0].clientY, scrollY: window.scrollY, lock: "pending", dragging: false };
    },
    onTouchMove(e: TouchEvent<HTMLElement>) {
      const g = gesture.current;
      if (!g || g.lock === "vertical") return;
      // 손가락이 늘면(확대) 이번 쓸기는 끝, 페이지가 스크롤됐어도 끝
      if (e.touches.length !== 1 || Math.abs(window.scrollY - g.scrollY) >= SWIPE_SCROLL_CANCEL_PX) {
        cancel(g);
        return;
      }
      const dx = e.touches[0].clientX - g.x;
      const dy = e.touches[0].clientY - g.y;
      if (g.lock === "pending") {
        if (Math.hypot(dx, dy) <= SWIPE_LOCK_PX) return;
        if (!isHorizontal(dx, dy, rules)) {
          g.lock = "vertical";
          return;
        }
        g.lock = "horizontal";
      }
      if (onDrag) {
        g.dragging = true;
        onDrag(dx);
      }
    },
    onTouchEnd(e: TouchEvent<HTMLElement>) {
      const g = gesture.current;
      gesture.current = null;
      if (!g) return;
      const end = e.changedTouches[0];
      const scrolled = Math.abs(window.scrollY - g.scrollY) >= SWIPE_SCROLL_CANCEL_PX;
      const direction = !end || g.lock === "vertical" || scrolled ? null : judgeSwipe(end.clientX - g.x, end.clientY - g.y, rules);
      if (direction) {
        if (g.dragging && onDragEnd) onDragEnd(direction);
        else onSwipe(direction);
      } else if (g.dragging) {
        onDragEnd?.(null);
      }
    },
    onTouchCancel() {
      const g = gesture.current;
      gesture.current = null;
      if (g?.dragging) onDragEnd?.(null);
    },
  };
}
