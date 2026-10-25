"use client";

import { useTranslations } from "next-intl";

/**
 * 우측 하단에 떠 있는 곡 검색 버튼 (서열표·곡 목록 공통, 2026-10-25).
 * 예전에는 서열표에서 이 버튼이 검색 창을 따로 열었다. 지금은 화면 위쪽의 검색창으로 가서 입력칸에 포커스를 준다:
 * 길게 내려온 뒤에도 위로 올라갈 필요 없이 바로 검색하고, 검색 UI는 화면마다 하나만 남는다.
 * 모바일에서는 포커스를 받으면 키보드가 바로 올라온다.
 * 위치는 하단 탭바 위(--tabbar-h)다. 같은 자리에 맨 위로 버튼(ScrollTopButton lifted)이 있으면 그쪽이 위로 올라간다.
 */
export function SearchFocusButton({ targetId }: { targetId: string }) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={() => focusSearch(targetId)}
      aria-label={t("Songs.searchAria")}
      title={t("Songs.searchAria")}
      className="fixed bottom-[calc(var(--tabbar-h)+1rem)] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-chip-on-bg text-chip-on-fg shadow-lg"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}

/**
 * 검색창을 화면 가운데로 부드럽게 옮기고 포커스를 준다. 스크롤은 직접 하므로 포커스는 preventScroll로 중복 이동을 막는다.
 * 일부 환경(테스트용 가짜 브라우저)에는 scrollIntoView가 없어서 있을 때만 부른다.
 */
function focusSearch(targetId: string): void {
  const target = document.getElementById(targetId);
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  target.focus({ preventScroll: true });
}
