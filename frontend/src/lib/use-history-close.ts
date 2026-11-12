"use client";

import { useEffect, useRef } from "react";
import { closeLayer, openLayer } from "@/lib/history-layers";

/**
 * 창·시트가 열려 있는 동안(`open`이 true) 뒤로 가기(휴대폰 뒤로 가기 제스처 포함)를 누르면 `onClose`가 불려 창만 닫히게 한다.
 * 열릴 때 history 한 칸을 더 쌓고, 닫힐 때(X·Esc·바깥 누르기 등 어떤 이유로든) 그 칸을 같이 걷어낸다. 규칙은 lib/history-layers.ts 머리말.
 * `onClose`는 최신 함수를 ref로 들고 있어서 부모가 매번 새 함수를 줘도 창이 다시 열린 것으로 보지 않는다.
 * 창 안에서 다른 화면으로 `router.push` 할 때는 그 직전에 `noteNavigationIntent()`(lib/history-layers.ts)를 부른다.
 */
export function useHistoryClose(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) {
      return;
    }
    const layer = openLayer(() => closeRef.current());
    return () => closeLayer(layer);
  }, [open]);
}
