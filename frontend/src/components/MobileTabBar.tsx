"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminNavLink } from "@/components/AdminNavLink";
import { useAuth } from "@/components/AuthProvider";
import { isActivePath } from "@/components/DesktopNav";
import { NavIcon } from "@/components/NavIcon";
import { MORE_ITEMS, SONG_PATHS, TAB_ITEMS } from "@/lib/nav";
import { useSongHomeHref } from "@/lib/song-tab";

const TAB_CLASS = "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]";

/**
 * lg(1024px) 미만 화면 하단에 고정되는 탭바(홈 · 곡 · 마이 · 더보기). 예전 헤더의 ☰ 메뉴는 이 `더보기`로 합쳤다. lg 이상은 헤더의 가로 메뉴(DesktopNav)가 있어 숨긴다.
 * `더보기`는 링크가 아니라 버튼이다: 누르면 자주 쓰지 않는 화면(가져오기·공지·유저·건의·설명서·설정)과 관리(ADMIN·ROOT)·로그인/로그아웃을 담은 시트가 탭바 위로 열린다.
 * 높이는 56px + 아이폰 하단 안전 영역이고, 같은 값을 CSS 변수 `--tabbar-h`(globals.css)로 두어
 * 본문 아래 여백·맨 위로 버튼·곡 검색 버튼·토스트가 탭바에 가려지지 않게 한다.
 * 현재 화면은 굵은 글자 + 진한 색 + aria-current로 알린다(색만으로 구분하지 않는다).
 * z-40: ☰ 슬라이드 메뉴(z-50)보다 아래, 일반 화면보다 위. 모달(dialog)은 top layer라 항상 탭바 위에 뜬다.
 */
export function MobileTabBar() {
  const t = useTranslations("Nav");
  const tc = useTranslations("Common");
  const pathname = usePathname();
  const songHref = useSongHomeHref();
  const { status, user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // Esc로 닫는다. 화면을 이동하면(pathname 변경) 시트 안 링크 클릭 핸들러가 닫아 준다.
  useEffect(() => {
    if (!moreOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* 바깥을 누르면 닫는다. 키보드 사용자는 Esc나 더보기 버튼을 쓴다 */}
          <div className="motion-fade absolute inset-0 bg-black/55" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <section
            aria-label={t("more")}
            className="motion-sheet absolute inset-x-0 bottom-[var(--tabbar-h)] max-h-[calc(100dvh-var(--tabbar-h)-3rem)] overflow-y-auto rounded-t-2xl border border-b-0 border-line bg-card px-4 pb-4 pt-3"
          >
            <h2 className="px-1 pb-1 text-[13px] font-bold text-fg-dim">{t("more")}</h2>
            <ul>
              {MORE_ITEMS.map((item) => (
                <li key={item.href} className="border-b border-line last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-[52px] items-center gap-3 px-1 text-[15px] text-fg"
                  >
                    <NavIcon name={item.icon} className="h-5 w-5 shrink-0 text-fg-sub" />
                    <span className="flex-1">{t(item.label)}</span>
                    {item.badge ? (
                      <span className="rounded bg-chip-on-bg px-2 py-0.5 font-num text-[11px] font-bold text-chip-on-fg">{t(item.badge)}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            {/* 관리(ADMIN·ROOT만)와 계정 줄: 예전 ☰ 메뉴에 있던 것을 이 시트로 합쳤다. 시트 안 링크는 눌러서 이동하면 닫힌다 */}
            <div className="border-t border-line">
              <AdminNavLink
                onClick={() => setMoreOpen(false)}
                showIcon
                className="flex min-h-[52px] items-center gap-3 border-b border-line px-1 text-[15px] text-fg"
              />
              {status === "authenticated" && user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    void logout();
                  }}
                  className="flex min-h-[52px] w-full items-center px-1 text-left text-[15px] text-fg-sub"
                >
                  {t("logout")}
                </button>
              ) : status === "anonymous" ? (
                <Link href="/login" onClick={() => setMoreOpen(false)} className="flex min-h-[52px] items-center px-1 text-[15px] text-fg">
                  {t("login")}
                </Link>
              ) : null}
            </div>
            <p className="mt-2 text-center text-[11px] text-fg-dim">
              <strong>{tc("unofficial")}</strong> · {t("notKonami")}
            </p>
          </section>
        </div>
      ) : null}
      <nav
        aria-label={t("bottom")}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {TAB_ITEMS.map((item) => {
          const active = !moreOpen && isActivePath(pathname, item.href, item.match);
          return (
            <Link
              key={item.href}
              href={item.match === SONG_PATHS ? songHref : item.href}
              aria-label={t(item.name)}
              aria-current={active ? "page" : undefined}
              onClick={() => setMoreOpen(false)}
              className={`${TAB_CLASS} ${active ? "font-bold text-fg" : "text-fg-dim hover:text-fg"}`}
            >
              <NavIcon name={item.icon} className="h-5 w-5" />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          className={`${TAB_CLASS} ${moreOpen ? "font-bold text-fg" : "text-fg-dim hover:text-fg"}`}
        >
          <NavIcon name="more" className="h-5 w-5" />
          <span>{t("more")}</span>
        </button>
      </nav>
    </>
  );
}
