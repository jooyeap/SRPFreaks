"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { folderHref } from "@/lib/difficulty-table";
import { formatTier } from "@/lib/format";
import type { TierGroupResponse } from "@/lib/api-types";

/**
 * 서열표 상단 "난이도 이동": 버튼 하나만 두고, 누르면 기준 난이도 목록이 펼쳐진다. 난이도를 누르면 그 묶음 페이지로 간다.
 * 예전에는 난이도 칩 20여 개를 한 줄로 늘어놓았는데 상단이 어수선해서 접었다(보조 기능이 본문보다 눈에 띄지 않게).
 * 칸마다 내 기록 수/전체를 보여 주고, 전부 기록한 난이도는 글자 색이 완료 색이 된다(`n/n`이 같이 있어 색만으로 구분하지 않는다).
 * 닫는 방법: 바깥 누르기, Esc, 난이도 누르기(이동하므로). 닫히면 포커스는 버튼으로 돌아온다.
 * 목록은 열려 있을 때만 그린다(닫힌 DOM에 링크가 남지 않아 화면 읽기 프로그램에도 한 번만 읽힌다).
 */
export function TierQuickNav({ groups }: { groups: readonly TierGroupResponse[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (groups.length === 0) {
    return null;
  }
  return (
    <div ref={rootRef} className="relative self-start">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-chip-line bg-card px-4 py-1.5 text-sm text-fg hover:bg-table-head"
      >
        난이도 이동
        <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <nav
          id={panelId}
          aria-label="난이도 바로가기"
          // 목록이 길어도 화면을 넘지 않게 높이를 제한하고 안에서 스크롤한다. 폭은 작은 화면(360px)에서도 들어가게 잡는다
          className="absolute left-0 top-full z-30 mt-2 max-h-[60vh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-line bg-card p-3"
        >
          <ul className="grid grid-cols-4 gap-2">
            {groups.map((g) => {
              const done = g.total > 0 && g.recorded >= g.total;
              return (
                <li key={g.tier ?? "undecided"} data-done={done ? "true" : undefined}>
                  <Link
                    href={folderHref(g.tier)}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center rounded-xl border border-chip-line px-1 py-1.5 hover:bg-table-head"
                  >
                    <span className={`font-num text-base font-bold ${done ? "text-done-text" : "text-fg"}`}>{formatTier(g.tier)}</span>
                    <span className="font-num text-[11px] text-fg-dim">
                      {g.recorded}/{g.total}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
