"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { HEADER_SEARCH_SLOT_ID } from "@/lib/header-slots";

/**
 * 좌측 하단에 떠 있는 곡 검색 버튼 (서열표·곡 목록 공통, 2026-10-25).
 * 예전에는 서열표에서 이 버튼이 검색 창을 따로 열었다. 지금은 화면 위쪽의 검색창으로 가서 입력칸에 포커스를 준다:
 * 길게 내려온 뒤에도 위로 올라갈 필요 없이 바로 검색하고, 검색 UI는 화면마다 하나만 남는다.
 * 모바일에서는 포커스를 받으면 키보드가 바로 올라온다.
 * 위치는 하단 탭바 위(--tabbar-h)의 왼쪽이다(2026-10-27). 예전에는 오른쪽이었는데 줄 오른쪽 끝의 `+` 버튼·점수를 가려서 옮겼다.
 * 맨 위로 버튼(ScrollTopButton)은 오른쪽 아래에 그대로 있어 두 버튼이 겹치지 않는다.
 * 2026-10-27(모바일): lg 미만에서는 떠 있는 버튼이 왼쪽 정렬된 줄 이름·곡명을 가려서, 떠 있는 버튼은 lg 이상에서만 보이고
 * lg 미만에서는 헤더의 빈 자리(HEADER_SEARCH_SLOT_ID)에 같은 동작의 작은 아이콘을 포털로 넣는다. 헤더 자리는 lg 이상에서 숨겨져 있다.
 */
export function SearchFocusButton({ targetId }: { targetId: string }) {
  const t = useTranslations();
  // 헤더 자리는 브라우저에서만 찾을 수 있다(서버 렌더 중에는 document가 없어 null). effect 안에서 setState를 하지 않으려고
  // useSyncExternalStore로 읽는다: 서버·첫 하이드레이션은 null, 그 뒤 브라우저 값(헤더는 항상 먼저 그려져 있다).
  const slot = useSyncExternalStore(subscribeNothing, findHeaderSlot, () => null);
  const icon = (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
  return (
    <>
      <button
        type="button"
        onClick={() => focusSearch(targetId)}
        aria-label={t("Songs.searchAria")}
        title={t("Songs.searchAria")}
        className="fixed bottom-[calc(var(--tabbar-h)+1rem)] left-4 z-30 hidden h-12 w-12 items-center justify-center rounded-full bg-chip-on-bg text-chip-on-fg shadow-lg lg:flex"
      >
        {icon}
      </button>
      {slot
        ? createPortal(
            <button
              type="button"
              onClick={() => focusSearch(targetId)}
              aria-label={t("Songs.searchAria")}
              title={t("Songs.searchAria")}
              data-header-search=""
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-ctl text-fg hover:bg-table-head"
            >
              {icon}
            </button>,
            slot,
          )
        : null}
    </>
  );
}

/** 헤더 자리는 바뀌지 않으므로 구독할 것이 없다 */
function subscribeNothing(): () => void {
  return () => {};
}

function findHeaderSlot(): HTMLElement | null {
  return document.getElementById(HEADER_SEARCH_SLOT_ID);
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
