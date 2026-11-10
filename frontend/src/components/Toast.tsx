"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

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
  /**
   * true이면 카드 아래에 남은 시간 막대를 보인다(`되돌리기`처럼 정해진 시간 안에 눌러야 하는 토스트용).
   * 이 토스트는 다른 안내가 와도 대체되지 않고 따로 쌓여서, 연속 삭제처럼 여러 개가 각자 자기 시간을 가진다.
   * 움직임 줄이기(prefers-reduced-motion) 설정에서는 막대 대신 남은 초 숫자를 보인다. 생략하면 막대가 없고 예전처럼 동작한다.
   */
  countdown?: boolean;
};

/** 토스트를 띄우고, 부르면 그 토스트를 닫는 함수를 돌려준다(쓰지 않아도 된다). */
type ShowToast = (message: string, options?: ToastOptions) => () => void;

/** Provider 밖(테스트 등)에서는 아무것도 하지 않는다. 안내가 없어도 기능은 그대로 돌아가야 한다. */
const ToastContext = createContext<ShowToast>(() => () => {});

/** 짧은 안내를 띄운다: `const toast = useToast(); toast("기록을 저장했습니다.")`, 실패는 `toast(문구, { kind: "error" })` */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

type Current = { id: number; message: string; kind: ToastKind; action?: ToastOptions["action"]; countdownMs?: number };

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
  // current: 보통 안내(새 안내가 이전 것을 대체). stack: countdown 토스트(서로 대체하지 않고 쌓인다)
  const [current, setCurrent] = useState<Current | null>(null);
  const [stack, setStack] = useState<Current[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const currentId = useRef<number | null>(null);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    if (currentId.current === id) currentId.current = null;
    setCurrent((now) => (now?.id === id ? null : now));
    setStack((now) => now.filter((item) => item.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, options) => {
      const id = ++nextId.current;
      const item: Current = {
        id,
        message,
        kind: options?.kind ?? "success",
        action: options?.action,
        countdownMs: options?.countdown ? (options.durationMs ?? SHOW_MS) : undefined,
      };
      if (options?.countdown) {
        setStack((now) => [...now, item]);
      } else {
        if (currentId.current !== null) remove(currentId.current);
        currentId.current = id;
        setCurrent(item);
      }
      timers.current.set(id, setTimeout(() => remove(id), options?.durationMs ?? SHOW_MS));
      return () => remove(id);
    },
    [remove],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  // 동작 버튼: 그 토스트만 닫고 동작을 부른다
  const actionOf = (item: Current) => () => {
    remove(item.id);
    item.action?.onAction();
  };

  const alertNow = current?.kind === "error" ? current : null;
  const statusNow = current && current.kind !== "error" ? current : null;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div data-toast-region className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--bottom-bar-h,0px)+1.5rem)] z-[60] flex justify-center px-4 md:justify-end md:px-6">
        <div role="status" aria-live="polite" className="contents">
          {stack.length > 0 ? (
            // 쌓인 토스트는 세로로 나란히(새것이 아래)
            <div className="flex min-w-0 max-w-full flex-col items-center gap-2 md:items-end">
              {statusNow ? <ToastCard current={statusNow} onAction={actionOf(statusNow)} /> : null}
              {stack.map((item) => (
                <ToastCard key={item.id} current={item} onAction={actionOf(item)} />
              ))}
            </div>
          ) : statusNow ? (
            <ToastCard current={statusNow} onAction={actionOf(statusNow)} />
          ) : null}
        </div>
        {/* role="alert"는 나타나는 순간 바로 읽히므로 오류가 있을 때만 그린다(빈 alert가 늘 떠 있으면 다른 화면의 alert 찾기와 섞인다) */}
        {alertNow ? (
          <div role="alert" className="contents">
            <ToastCard current={alertNow} onAction={actionOf(alertNow)} />
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ current, onAction }: { current: Current; onAction: () => void }) {
  const style = KIND_STYLE[current.kind];
  return (
    <div className={`motion-reveal relative flex max-w-full items-center gap-2 overflow-hidden rounded-2xl border bg-card px-4 py-2.5 text-sm shadow-lg ${style.border}`}>
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
      {current.countdownMs !== undefined ? <Countdown ms={current.countdownMs} /> : null}
    </div>
  );
}

/**
 * 남은 시간 표시. 기본은 카드 아래의 막대가 `ms` 동안 줄어든다(CSS 애니메이션, 색은 --done 토큰).
 * 움직임 줄이기 설정이면 애니메이션 없이 남은 초를 숫자로 보인다(1초마다 바뀜). 장식이라 화면 읽기 프로그램에는 읽히지 않는다
 * (남은 시간 안내는 문구와 `되돌리기` 버튼이 전한다).
 */
function Countdown({ ms }: { ms: number }) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [left, setLeft] = useState(Math.ceil(ms / 1000));
  useEffect(() => {
    if (!reduced) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setLeft(Math.max(0, Math.ceil((ms - (Date.now() - startedAt)) / 1000))), 250);
    return () => clearInterval(timer);
  }, [reduced, ms]);
  if (reduced) {
    return (
      <span data-countdown="number" aria-hidden="true" className="font-num ml-1 grid h-5 min-w-5 shrink-0 place-items-center rounded-full border border-done px-1 text-xs font-bold text-done-text">
        {left}
      </span>
    );
  }
  return (
    <span aria-hidden="true" data-countdown="bar" className="absolute inset-x-0 bottom-0 h-1 bg-line">
      <span className="toast-countdown-bar block h-full bg-done" style={{ animationDuration: `${ms}ms` }} />
    </span>
  );
}
