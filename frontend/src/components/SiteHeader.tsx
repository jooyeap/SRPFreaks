import Link from "next/link";
import { AuthControls } from "@/components/AuthControls";
import { ThemeToggle } from "@/components/ThemeToggle";

/** 모든 화면 상단: "비공식 팬 프로젝트" 고지 + 서비스 이름 + 테마 버튼 (DESIGN-UI 1장). */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-card">
      <p className="bg-table-head px-4 py-1 text-center text-xs text-fg-sub">비공식 팬 프로젝트</p>
      <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-num text-lg font-semibold tracking-wide text-fg">
            SRPFreaks
          </Link>
          <nav aria-label="주요 메뉴" className="flex items-center gap-3">
            <Link href="/table" className="text-sm text-fg-sub hover:text-fg">
              서열표
            </Link>
            <Link href="/rating" className="text-sm text-fg-sub hover:text-fg">
              레이팅
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <AuthControls />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
