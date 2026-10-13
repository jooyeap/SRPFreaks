import Link from "next/link";
import { AuthControls } from "@/components/AuthControls";
import { MobileMenu } from "@/components/MobileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * 모든 화면 상단: 서비스 이름 + 메뉴 + 테마 스위치. "비공식 팬 프로젝트" 고지는 하단 SiteFooter로 옮겼다 (DESIGN-UI 1장).
 * 모든 화면 폭에서 한 줄에 `이름 ... (로그인 상태, sm 이상만) 테마 스위치, ☰`만 두고 주 메뉴는 슬라이드 메뉴(MobileMenu)로 보낸다.
 * 메뉴 항목이 늘어 가로 한 줄로는 복잡해져서 데스크톱도 같은 방식으로 바꿨다.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex w-full max-w-[980px] items-center gap-x-4 px-4 py-2.5">
        <Link href="/" className="font-num text-lg font-semibold tracking-wide text-fg">
          SRPFreaks
        </Link>
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
