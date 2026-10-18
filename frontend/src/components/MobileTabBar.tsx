"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath } from "@/components/DesktopNav";
import { NavIcon } from "@/components/NavIcon";
import { TAB_ITEMS } from "@/lib/nav";

/**
 * lg(1024px) 미만 화면 하단에 고정되는 탭바(홈 · 곡 · 서열표 · 마이). lg 이상은 헤더의 가로 메뉴(DesktopNav)가 있어 숨긴다.
 * 높이는 56px + 아이폰 하단 안전 영역이고, 같은 값을 CSS 변수 `--tabbar-h`(globals.css)로 두어
 * 본문 아래 여백·맨 위로 버튼·곡 검색 버튼·토스트가 탭바에 가려지지 않게 한다.
 * 현재 화면은 굵은 글자 + 진한 색 + aria-current로 알린다(색만으로 구분하지 않는다).
 * z-40: ☰ 슬라이드 메뉴(z-50)보다 아래, 일반 화면보다 위. 모달(dialog)은 top layer라 항상 탭바 위에 뜬다.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TAB_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.name}
            aria-current={active ? "page" : undefined}
            className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
              active ? "font-bold text-fg" : "text-fg-dim hover:text-fg"
            }`}
          >
            <NavIcon name={item.icon} className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
