import Link from "next/link";
import { AuthControls } from "@/components/AuthControls";
import { DesktopNav } from "@/components/DesktopNav";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * 모든 화면 상단: 서비스 이름 + 메뉴 + 테마 스위치. "비공식 팬 프로젝트" 고지는 하단 SiteFooter로 옮겼다 (DESIGN-UI 1장).
 * - lg(1024px) 이상: `이름 · 가로 메뉴(DesktopNav) · 로그인 상태 · 테마 스위치`.
 * - lg 미만: `이름 ... (로그인 상태, sm 이상만) 테마 스위치`만 두고 메뉴는 하단 탭바(MobileTabBar)의 `더보기`가 맡는다(2026-10-20에 ☰ 슬라이드 메뉴를 없앴다).
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
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
