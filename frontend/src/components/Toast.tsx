"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const SHOW_MS = 2800;

type ShowToast = (message: string) => void;

/** Provider 밖(테스트 등)에서는 아무것도 하지 않는다. 안내가 없어도 기능은 그대로 돌아가야 한다. */
const ToastContext = createContext<ShowToast>(() => {});

/** 짧은 안내를 띄운다: `const toast = useToast(); toast("기록을 저장했습니다.")` */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

/**
 * 화면 아래에 몇 초 떠 있다 사라지는 한 줄 안내. 기록 창처럼 저장 직후 닫히는 곳의 "저장됐다"는 확인용이다.
 * role="status"(aria-live)라서 화면 읽기 프로그램에도 읽힌다. 새 안내가 오면 이전 것을 대체한다.
 * 위치: 모바일은 아래 가운데, 데스크톱(md 이상)은 오른쪽 아래다. 떠 있는 버튼(검색·맨 위로) 위에 잠깐 겹칠 수 있어서 클릭은 통과시킨다(pointer-events-none).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((next) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), SHOW_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:justify-end md:px-6">
        {message ? (
          <p className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-fg shadow-lg">
            {/* 체크 표시는 장식이고, 뜻은 문구가 전한다 */}
            <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-chip-on-bg text-xs text-chip-on-fg">
              ✓
            </span>
            {message}
          </p>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
