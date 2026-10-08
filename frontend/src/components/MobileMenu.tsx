"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminNavLink } from "@/components/AdminNavLink";
import { AuthControls } from "@/components/AuthControls";
import { NAV_ITEMS } from "@/lib/nav";

const FOCUSABLE = "a[href], button:not([disabled])";

const ITEM_CLASS = "block rounded-xl px-3 py-3 text-base font-semibold text-fg hover:bg-table-head";

/**
 * 모바일(sm 미만) 헤더 메뉴: 햄버거 버튼을 누르면 오른쪽에서 슬라이드 메뉴가 나온다. sm 이상에서는 버튼이 보이지 않는다.
 * 닫는 방법: 바깥 어두운 영역 누르기, 닫기 버튼, Esc, 메뉴 안의 링크·버튼 누르기(이동하면 닫혀야 해서).
 * 접근성: role="dialog" aria-modal, 열면 닫기 버튼으로 포커스가 가고 Tab이 메뉴 안에서만 돌며, 닫으면 햄버거로 돌아온다.
 * 패널은 열려 있을 때만 그린다. 닫힌 상태의 DOM에 링크가 이중으로 남지 않아 화면 읽기 프로그램에도 한 번만 읽힌다.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeRef.current?.focus();
    // 메뉴 뒤 화면이 같이 스크롤되지 않게 잠근다
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }
      // 포커스 가두기: 처음/끝에서 Tab을 누르면 반대쪽 끝으로 보낸다
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-chip-line text-fg-sub hover:text-fg sm:hidden"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* 바깥을 누르면 닫는다. 키보드 사용자는 닫기 버튼/Esc를 쓰므로 포커스 대상에서 뺀다 */}
          <div className="drawer-overlay absolute inset-0 bg-black/50" onClick={close} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="메뉴"
            // 안의 링크·버튼(이동, 로그인, 로그아웃)을 누르면 메뉴를 닫는다
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a, button")) {
                setOpen(false);
              }
            }}
            className="drawer-panel absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto border-l border-line bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-num text-lg font-semibold tracking-wide text-fg">SRPFreaks</span>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="메뉴 닫기"
                className="grid h-9 w-9 place-items-center rounded-full border border-chip-line text-fg-sub hover:text-fg"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav aria-label="주요 메뉴(모바일)" className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className={ITEM_CLASS}>
                  {item.label}
                </Link>
              ))}
              <AdminNavLink className={ITEM_CLASS} />
            </nav>
            <div className="mt-auto border-t border-line pt-4">
              <AuthControls />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
