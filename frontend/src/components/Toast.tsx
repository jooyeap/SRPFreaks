"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const SHOW_MS = 2800;

/** 성공(초록 ✓) / 오류(빨강 !) / 안내(파랑 i). 색만으로 전하지 않도록 종류마다 아이콘 글자를 같이 쓴다. */
export type ToastKind = "success" | "error" | "info";

export type ToastOptions = {
  /** 생략하면 성공이다. */
  kind?: ToastKind;
  /** 오른쪽 선택 버튼(`보기` / `되돌리기` / `다시 시도` 같은 명사형 글자). 누르면 onAction을 부르고 토스트를 닫는다. */
  action?: { label: string; onAction: () => void };
  /** 떠 있는 시간(ms). 생략하면 2.8초다. */
  durationMs?: number;
};

type ShowToast = (message: string, options?: ToastOptions) => void;

/** Provider 밖(테스트 등)에서는 아무것도 하지 않는다. 안내가 없어도 기능은 그대로 돌아가야 한다. */
const ToastContext = createContext<ShowToast>(() => {});

/** 짧은 안내를 띄운다: `const toast = useToast(); toast("기록을 저장했습니다.")`, 실패는 `toast(문구, { kind: "error" })` */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

type Current = { message: string; kind: ToastKind; action?: ToastOptions["action"] };

/** 종류별 아이콘 글자와 색. 색은 globals.css의 변수(--done, --danger, --check)를 쓰는 유틸리티만 쓴다. */
const KIND_STYLE: Record<ToastKind, { icon: string; border: string; iconText: string }> = {
  success: { icon: "✓", border: "border-done", iconText: "text-done-text" },
  error: { icon: "!", border: "border-danger", iconText: "text-danger" },
  info: { icon: "i", border: "border-check-line", iconText: "text-check-fg" },
};

/**
 * 화면 아래에 몇 초 떠 있다 사라지는 한 줄 안내. 기록 창처럼 저장 직후 닫히는 곳의 "저장됐다"는 확인용이다.
 * 성공·안내는 role="status"(처음부터 그려 둔 영역에 내용이 들어옴), 오류는 role="alert"(나타나는 순간 바로 읽힘)다.
 * 새 안내가 오면 이전 것을 대체한다.
 * 위치: 모바일은 아래 가운데, 데스크톱(md 이상)은 오른쪽 아래다. 떠 있는 버튼(검색·맨 위로) 위에 잠깐 겹칠 수 있어서
 * 바탕은 클릭을 통과시키고(pointer-events-none) 동작 버튼만 누를 수 있다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Current | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((message, options) => {
    setCurrent({ message, kind: options?.kind ?? "success", action: options?.action });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCurrent(null), options?.durationMs ?? SHOW_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onAction = () => {
    const action = current?.action;
    if (timer.current) clearTimeout(timer.current);
    setCurrent(null);
    action?.onAction();
  };

  const alertNow = current?.kind === "error" ? current : null;
  const statusNow = current && current.kind !== "error" ? current : null;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div data-toast-region className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+1.5rem)] z-[60] flex justify-center px-4 md:justify-end md:px-6">
        <div role="status" aria-live="polite" className="contents">
          {statusNow ? <ToastCard current={statusNow} onAction={onAction} /> : null}
        </div>
        {/* role="alert"는 나타나는 순간 바로 읽히므로 오류가 있을 때만 그린다(빈 alert가 늘 떠 있으면 다른 화면의 alert 찾기와 섞인다) */}
        {alertNow ? (
          <div role="alert" className="contents">
            <ToastCard current={alertNow} onAction={onAction} />
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ current, onAction }: { current: Current; onAction: () => void }) {
  const style = KIND_STYLE[current.kind];
  return (
    <div className={`motion-reveal flex max-w-full items-center gap-2 rounded-2xl border bg-card px-4 py-2.5 text-sm shadow-lg ${style.border}`}>
      {/* 아이콘은 장식이고(뜻은 문구가 전한다) 종류마다 글자가 다르다: ✓ / ! / i */}
      <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs font-bold ${style.iconText}`}>
        {style.icon}
      </span>
      <p className="min-w-0 font-semibold text-fg">{current.message}</p>
      {current.action ? (
        <button type="button" onClick={onAction} className="pointer-events-auto -my-1 -mr-2 shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-fg underline underline-offset-2">
          {current.action.label}
        </button>
      ) : null}
    </div>
  );
}
