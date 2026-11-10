"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SHOW_AFTER_PX = 600;

/**
 * 긴 화면에서 조금 내려오면 나타나는 `맨 위로` 버튼(오른쪽 아래). 맨 위 근처에서는 보이지 않는다.
 * lifted: 같은 자리에 다른 떠 있는 버튼(서열표의 곡 검색 48px)이 있으면 그 위로 올린다.
 * 2026-10-27(모바일): lg 미만에서는 36px로 작고 반투명하게 두고, 목록 맨 아래에 버튼 높이만큼 빈칸을 남겨
 * 마지막 줄의 점수·글자가 버튼에 가려지지 않게 한다(빈칸은 버튼이 안 보일 때도 남아 있어 스크롤 길이가 바뀌지 않는다).
 */
export function ScrollTopButton({ lifted = false }: { lifted?: boolean }) {
  const t = useTranslations("Common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const spacer = <div aria-hidden="true" className="h-12 lg:hidden" />;
  if (!visible) {
    return spacer;
  }
  return (
    <>
    {spacer}
    <button
      type="button"
      aria-label={t("scrollTop")}
      title={t("scrollTop")}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-ctl bg-card/85 text-fg shadow-lg hover:bg-table-head lg:right-4 lg:h-11 lg:w-11 lg:bg-card ${
        lifted ? "bottom-[calc(var(--tabbar-h)+5rem)]" : "bottom-[calc(var(--tabbar-h)+1rem)]"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 15 6-6 6 6" />
      </svg>
    </button>
    </>
  );
}
