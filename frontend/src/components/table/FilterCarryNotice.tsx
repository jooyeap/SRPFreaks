"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FILTER_NOTICE_IDLE_MS, FILTER_NOTICE_MAX_MS } from "@/lib/folder-filter-carry";
import { useTranslations } from "next-intl";

/** 화면 어디서든 "사용자가 뭔가 했다"로 보는 입력 */
const INPUT_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * 필터를 싣고 옆 폴더로 넘어온 직후에 뜨는 작은 안내(D99): `필터가 적용되어 있습니다. 초기화할까요?` + `초기화` 버튼.
 * 공용 토스트(Toast.tsx)를 쓰지 않는 이유: 그쪽은 정해진 시간 뒤에 무조건 닫히고 바탕이 클릭을 통과시키며,
 * 입력이 있으면 연장하거나 눌렀을 때 동작하는 규칙이 없다. 이 안내는 그 규칙이 핵심이라 한 곳에 따로 둔다(색·모양은 토스트 `안내`와 같은 토큰).
 *
 * 사라지는 규칙:
 *  - 입력(누르기·스크롤·키)이 FILTER_NOTICE_IDLE_MS(5초) 동안 없으면 사라진다. 입력이 있을 때마다 그 시간을 다시 센다.
 *  - 입력이 계속 이어져도 FILTER_NOTICE_MAX_MS(15초)가 되면 사라진다(스크롤만 하는 사람에게 안내가 남지 않게).
 *  - 안내 위에 손가락·마우스가 있거나 안내 안에 포커스가 있으면 시간이 멈추고, 떠나면 다시 센다(읽는 중·누르려는 중에 사라지지 않게).
 *  - 안내(또는 `초기화` 버튼)를 누르면 onReset을 부르고 사라진다. 안내를 누르는 것은 마우스·터치용 편의이고, 키보드·화면 읽기 프로그램은 안의 `초기화` 버튼을 쓴다.
 *
 * 읽어 주기: 바깥 영역(role="status", aria-live="polite")은 처음부터 그려 두고, 안내 내용은 그 다음 렌더에서 넣는다.
 * 영역과 내용이 같은 순간에 생기면 화면 읽기 프로그램이 읽지 않는 경우가 있어서다.
 * 위치: 하단 탭바와 폴더 이웃 이동 바(--bottom-bar-h) 바로 위. 바탕 영역은 클릭을 통과시키고(pointer-events-none) 안내 카드만 눌린다.
 */
export function FilterCarryNotice({ show, onReset }: { show: boolean; onReset: () => void }) {
  const t = useTranslations();
  const [visible, setVisible] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!show) return;
    // 영역이 먼저 그려진 뒤 내용을 넣는다(다음 틱). 효과 안에서 바로 setState 하면 같은 렌더에 묶여 영역과 내용이 동시에 생긴다
    const id = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(id);
  }, [show]);

  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = pausedRef.current ? null : setTimeout(hide, FILTER_NOTICE_IDLE_MS);
  }, [hide]);

  useEffect(() => {
    if (!visible) return;
    armIdle();
    const maxTimer = setTimeout(hide, FILTER_NOTICE_MAX_MS);
    INPUT_EVENTS.forEach((name) => window.addEventListener(name, armIdle, { passive: true, capture: true }));
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = null;
      clearTimeout(maxTimer);
      INPUT_EVENTS.forEach((name) => window.removeEventListener(name, armIdle, { capture: true }));
    };
  }, [visible, armIdle, hide]);

  function pause() {
    pausedRef.current = true;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }
  function resume() {
    pausedRef.current = false;
    armIdle();
  }
  function reset() {
    onReset();
    hide();
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="filter-carry-region"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--bottom-bar-h,0px)+0.5rem)] z-[55] flex justify-center px-4"
    >
      {visible ? (
        <div
          data-testid="filter-carry-notice"
          onClick={reset}
          onPointerEnter={pause}
          onPointerLeave={resume}
          onFocusCapture={pause}
          onBlurCapture={resume}
          className="motion-reveal pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl border border-check-line bg-card py-1 pl-3 pr-1 text-sm shadow-lg"
        >
          {/* 아이콘 글자 `i`와 문구를 같이 보여 색만으로 전하지 않는다(공용 토스트 `안내`와 같다) */}
          <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs font-bold text-check-fg">
            i
          </span>
          <p className="min-w-0 break-keep font-semibold leading-snug text-fg">{t("Table.filterCarryNotice")}</p>
          {/* 누르는 영역 44px 이상 */}
          <button
            type="button"
            aria-label={t("Table.filterReset")}
            onClick={(e) => {
              e.stopPropagation(); // 바깥 카드의 onClick과 두 번 부르지 않는다
              reset();
            }}
            className="min-h-11 min-w-11 shrink-0 rounded-xl border border-ctl px-3 text-sm font-semibold text-fg hover:bg-table-head"
          >
            {t("Table.filterCarryReset")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
