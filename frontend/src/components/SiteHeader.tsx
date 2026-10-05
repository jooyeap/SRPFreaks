import Link from "next/link";
import { AuthControls } from "@/components/AuthControls";
import { ThemeToggle } from "@/components/ThemeToggle";

/** 모든 화면 상단: "비공식 팬 프로젝트" 고지 + 서비스 이름 + 테마 버튼 (DESIGN-UI 1장). */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-card">
      <p className="bg-table-head px-4 py-1 text-center text-xs text-fg-sub">비공식 팬 프로젝트</p>
      {/* 모바일: 윗줄 = 이름 + (로그아웃, 테마), 아랫줄 = 메뉴 탭(폭을 나눠 가짐). sm 이상: 한 줄에 이름, 메뉴, 오른쪽 도구 */}
      <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <Link href="/" className="font-num text-lg font-semibold tracking-wide text-fg">
          SRPFreaks
        </Link>
        <nav aria-label="주요 메뉴" className="order-last flex w-full gap-1.5 sm:order-none sm:w-auto sm:gap-3">
          <Link
            href="/table"
            className="flex-1 whitespace-nowrap rounded-xl border border-line py-1.5 text-center text-sm font-semibold text-fg-sub hover:text-fg sm:flex-none sm:border-0 sm:py-0 sm:font-normal"
          >
            서열표
          </Link>
          <Link
            href="/rating"
            className="flex-1 whitespace-nowrap rounded-xl border border-line py-1.5 text-center text-sm font-semibold text-fg-sub hover:text-fg sm:flex-none sm:border-0 sm:py-0 sm:font-normal"
          >
            레이팅
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
          <AuthControls />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
