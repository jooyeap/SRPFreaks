"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { NavView } from "@/lib/detail-nav";
import { dismissDetailNavHint, isDetailNavHintDismissed } from "@/lib/detail-nav-hint";
import { formatTier } from "@/lib/format";
import { useTranslations } from "next-intl";

/** 바 높이(3.5rem). 토스트가 바 위로 올라가도록 CSS 변수로 알린다(Toast.tsx) */
const subscribeNone = () => () => {};
const BAR_HEIGHT = "3.5rem";

/**
 * 곡 상세 아래 고정 바: `‹ 이전 · 3/12 · 서열표 5.3 · 다음 ›`. 하단 탭바(--tabbar-h) 바로 위에 고정한다.
 * 처음/끝은 흐리게 막는다(링크 아님). 서열표에서 묶음 경계에 있으면 이름이 `이전 묶음 5.2` / `다음 묶음 5.4`로 바뀐다.
 * 곡 목록에서 들어왔으면 가운데는 `곡 목록`이다. 터치 높이 44px.
 * 안내 말풍선(좌우로 밀어도 이동)은 이 기기에서 처음 한 번만 보이고 ×로 닫는다.
 */
export function SongNavBar({ view, onStep }: { view: NavView; onStep: (direction: "prev" | "next") => void }) {
  const t = useTranslations();
  // 저장소는 브라우저에서만 읽는다(서버 렌더 값은 닫힘). 닫으면 dismissed로 바로 다시 그린다
  const [dismissed, setDismissed] = useState(false);
  const stored = useSyncExternalStore(subscribeNone, () => !isDetailNavHintDismissed(), () => false);
  const hintOpen = stored && !dismissed;

  useEffect(() => {
    document.documentElement.style.setProperty("--bottom-bar-h", BAR_HEIGHT);
    return () => {
      document.documentElement.style.removeProperty("--bottom-bar-h");
    };
  }, []);
  const label = (dir: "prev" | "next") => {
    const step = view[dir];
    if (step?.kind === "go" && step.tier !== undefined) {
      return t(dir === "prev" ? "Song.navPrevTier" : "Song.navNextTier", { tier: formatTier(step.tier, t) });
    }
    return t(dir === "prev" ? "Common.prev" : "Common.next");
  };
  const center = view.tier !== null ? t("Song.navTable", { tier: formatTier(view.tier, t) }) : t("Song.navSongs");

  return (
    <>
      {hintOpen ? (
        <div
          role="status"
          className="motion-reveal fixed inset-x-0 bottom-[calc(var(--tabbar-h)+3.5rem+0.5rem)] z-30 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-start gap-2 rounded-xl border border-ctl bg-card px-3 py-2 text-sm text-fg shadow-lg"
        >
          <span className="flex-1">{t("Song.navHint")}</span>
          <button
            type="button"
            aria-label={t("Song.navHintClose")}
            onClick={() => {
              dismissDetailNavHint();
              setDismissed(true);
            }}
            className="-my-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-sub hover:text-fg"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}
      <nav aria-label={t("Song.navAria")} className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 border-t border-line bg-card">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-2 px-4 lg:pl-20">
          <Side dir="prev" enabled={view.prev !== null} label={label("prev")} onStep={onStep} />
          <p className="min-w-0 truncate text-center text-xs text-fg-sub">
            <span className="font-num font-bold text-fg">
              {view.position}/{view.total}
            </span>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            {center}
          </p>
          <Side dir="next" enabled={view.next !== null} label={label("next")} onStep={onStep} />
        </div>
      </nav>
    </>
  );
}

function Side({ dir, enabled, label, onStep }: { dir: "prev" | "next"; enabled: boolean; label: string; onStep: (d: "prev" | "next") => void }) {
  const arrow = <span aria-hidden="true" className="text-lg leading-none">{dir === "prev" ? "‹" : "›"}</span>;
  const text = <span className="whitespace-nowrap text-sm font-semibold">{label}</span>;
  const base = `flex min-h-11 items-center gap-1.5 rounded-xl border px-3 ${dir === "next" ? "justify-end" : "justify-start"}`;
  if (!enabled) {
    return (
      <span aria-disabled="true" className={`${base} border-line text-disabled`}>
        {dir === "prev" ? arrow : null}
        {text}
        {dir === "next" ? arrow : null}
      </span>
    );
  }
  return (
    <button type="button" onClick={() => onStep(dir)} className={`${base} border-ctl text-fg hover:bg-table-head`}>
      {dir === "prev" ? arrow : null}
      {text}
      {dir === "next" ? arrow : null}
    </button>
  );
}
