"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";

type GuideTab = "rating" | "rival";

function subscribeNothing(): () => void {
  return () => {};
}

function readTabFromUrl(): GuideTab | null {
  return new URLSearchParams(window.location.search).get("tab") === "rival" ? "rival" : null;
}

/**
 * 설명서의 `레이팅 / 라이벌` 탭(D56). 주소 `?tab=rival`이면 라이벌 탭으로 연다.
 * 첫 그림은 항상 레이팅 탭이고(서버 그림과 같게), 하이드레이션 뒤 주소를 읽어 바꾼다. 탭을 누르면 주소만 바꾸고 기록은 쌓지 않는다.
 */
export function GuideTabs({ rating, rival }: { rating: ReactNode; rival: ReactNode }) {
  const t = useTranslations("Guide");
  // 주소의 탭은 useSyncExternalStore로 읽는다: 서버·첫 하이드레이션은 null(레이팅), 그 뒤 브라우저 주소 값.
  // 사용자가 탭을 누르면 그 선택(picked)이 주소보다 먼저다.
  const fromUrl = useSyncExternalStore(subscribeNothing, readTabFromUrl, () => null);
  const [picked, setPicked] = useState<GuideTab | null>(null);
  const tab: GuideTab = picked ?? fromUrl ?? "rating";

  const choose = (next: GuideTab) => {
    setPicked(next);
    const url = new URL(window.location.href);
    if (next === "rival") url.searchParams.set("tab", "rival");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  };

  const items: readonly { value: GuideTab; label: string }[] = [
    { value: "rating", label: t("tabRating") },
    { value: "rival", label: t("tabRival") },
  ];
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
      <div role="tablist" aria-label={t("tabsAria")} className="flex gap-1 rounded-xl border border-line bg-table-head p-1">
        {items.map((item) => {
          const selected = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`guide-tab-${item.value}`}
              aria-selected={selected}
              aria-controls="guide-panel"
              onClick={() => choose(item.value)}
              className={`min-h-10 flex-1 rounded-lg px-4 text-sm ${selected ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-sub hover:text-fg"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="guide-panel" aria-labelledby={`guide-tab-${tab}`}>
        {tab === "rating" ? rating : rival}
      </div>
    </div>
  );
}
