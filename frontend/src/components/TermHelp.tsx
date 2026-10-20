"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { TERM_HELP, type TermKey } from "@/lib/term-help";
import { useTranslations } from "next-intl";

/**
 * 낯선 용어 옆의 작은 `?` 버튼. 누르면 한두 줄 설명과 설명서 링크가 담긴 말풍선이 열린다.
 * 접근성: 버튼은 aria-expanded/aria-controls로 열림 상태를 알리고, 눈에 보이는 `?`는 장식이라 이름은 "… 설명 보기"다.
 * 터치 영역은 44px을 확보하되(투명 여백) 눈에 보이는 원은 24px이다. 바깥을 누르거나 Esc를 누르면 닫히고 포커스는 버튼으로 돌아온다.
 * hover 툴팁은 쓰지 않는다(모바일에는 hover가 없다).
 */
export function TermHelp({ term, label }: { term: TermKey; label: string }) {
  const t = useTranslations("TermHelp");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const help = TERM_HELP[term];

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("viewHelp", { label })}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="-m-2.5 grid h-11 w-11 place-items-center"
      >
        <span
          aria-hidden="true"
          className={`grid h-6 w-6 place-items-center rounded-full border font-num text-[13px] font-bold ${
            open ? "border-chip-on-bg text-fg" : "border-chip-line text-fg-dim"
          }`}
        >
          ?
        </span>
      </button>
      {open ? (
        <span
          id={panelId}
          role="dialog"
          aria-label={t("helpLabel", { label })}
          className="absolute left-0 top-full z-30 mt-2 flex w-64 max-w-[80vw] flex-col gap-2 whitespace-normal rounded-xl border border-chip-on-bg bg-table-head p-3 text-left font-sans font-normal shadow-lg"
        >
          <span className="text-[13px] font-bold text-fg">{t(help.title)}</span>
          <span className="flex flex-col gap-1.5 text-xs leading-relaxed text-fg-sub">
            {help.lines.map((line) => (
              <span key={line}>{t(line)}</span>
            ))}
          </span>
          <Link href="/guide" className="flex min-h-11 items-center self-start text-[13px] text-fg underline">
            {t("guideLink")}
          </Link>
        </span>
      ) : null}
    </span>
  );
}
