import Link from "next/link";
import { AdminNavLink, DESKTOP_LINK_CLASS } from "@/components/AdminNavLink";
import { AuthControls } from "@/components/AuthControls";
import { MobileMenu } from "@/components/MobileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NAV_ITEMS } from "@/lib/nav";

/**
 * 모든 화면 상단: 서비스 이름 + 메뉴 + 테마 스위치. "비공식 팬 프로젝트" 고지는 하단 SiteFooter로 옮겼다 (DESIGN-UI 1장).
 * 모바일(sm 미만)은 한 줄에 `이름 ... 테마 스위치, ☰`만 두고 메뉴·로그인은 슬라이드 메뉴(MobileMenu)로 보낸다.
 * sm 이상은 한 줄에 이름, 메뉴, 오른쪽 도구(로그인 상태, 테마)를 모두 보인다.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex w-full max-w-[980px] items-center gap-x-4 px-4 py-2.5">
        <Link href="/" className="font-num text-lg font-semibold tracking-wide text-fg">
          SRPFreaks
        </Link>
        <nav aria-label="주요 메뉴" className="hidden items-center gap-3 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={DESKTOP_LINK_CLASS}>
              {item.label}
            </Link>
          ))}
          <AdminNavLink />
        </nav>
        <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
          <div className="hidden sm:block">
            <AuthControls />
          </div>
          <ThemeToggle />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
