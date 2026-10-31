import Link from "next/link";
import { AuthControls } from "@/components/AuthControls";
import { DesktopNav } from "@/components/DesktopNav";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HEADER_SEARCH_SLOT_ID } from "@/lib/header-slots";

/**
 * 모든 화면 상단: 서비스 이름 + 메뉴 + 테마 스위치. "비공식 팬 프로젝트" 고지는 하단 SiteFooter로 옮겼다 (DESIGN-UI 1장).
 * - lg(1024px) 이상: `이름 · 가로 메뉴(DesktopNav) · 로그인 상태 · 테마 스위치`.
 * - lg 미만: `이름 ... (로그인 상태, sm 이상만) 테마 스위치`만 두고 메뉴는 하단 탭바(MobileTabBar)의 `더보기`가 맡는다(2026-10-20에 ☰ 슬라이드 메뉴를 없앴다).
 * - 로그인했으면 언어 버튼 왼쪽에 알림 종(D56)이 있다.
 * - 검색이 있는 화면(서열표·곡 목록)에서는 lg 미만일 때 언어 버튼 왼쪽에 곡 검색 아이콘이 들어간다(빈 자리에 SearchFocusButton이 포털로 넣는다, 2026-10-27).
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-card pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-x-4 px-4 py-2.5">
        <Link href="/" className="font-num text-lg font-semibold tracking-wide text-fg">
          SRPFreaks
        </Link>
        <DesktopNav />
        <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
          <div className="hidden sm:block">
            <AuthControls />
          </div>
          <span id={HEADER_SEARCH_SLOT_ID} className="contents lg:hidden" />
          <NotificationBell />
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
