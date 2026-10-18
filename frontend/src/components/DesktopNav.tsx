"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminNavLink } from "@/components/AdminNavLink";
import { DESKTOP_NAV_ITEMS, MY_PAGE_ITEM } from "@/lib/nav";

const BASE = "flex min-h-9 items-center whitespace-nowrap rounded-lg px-3 text-sm";
const ACTIVE = `${BASE} bg-table-head font-bold text-fg`;
const IDLE = `${BASE} text-fg-sub hover:text-fg`;

/** 현재 경로가 이 메뉴 항목의 화면인가. 홈("/")은 정확히 같을 때만, 나머지는 하위 경로(/songs/12 등)도 같은 메뉴로 본다. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 데스크톱(lg 이상) 헤더의 가로 메뉴. lg 미만에서는 숨기고 ☰ 슬라이드 메뉴(MobileMenu)를 쓴다.
 * 현재 화면은 배경 + 굵은 글자로 강조하고 aria-current="page"를 단다(색만으로 구분하지 않는다).
 * usePathname을 쓰려고 클라이언트 컴포넌트로 뒀다. 헤더 자체는 서버 컴포넌트로 남는다.
 */
export function DesktopNav() {
  const pathname = usePathname();
  const items = [...DESKTOP_NAV_ITEMS, MY_PAGE_ITEM];
  return (
    <nav aria-label="주요 메뉴" className="hidden flex-1 items-center gap-1 lg:flex">
      {items.map((item) => {
        // 관리 링크는 마이페이지 바로 앞에 끼운다 (ADMIN·ROOT에게만 그려진다)
        const active = isActivePath(pathname, item.href);
        return (
          <span key={item.href} className="contents">
            {item.href === MY_PAGE_ITEM.href ? <AdminNavLink className={IDLE} /> : null}
            <Link href={item.href} className={active ? ACTIVE : IDLE} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
