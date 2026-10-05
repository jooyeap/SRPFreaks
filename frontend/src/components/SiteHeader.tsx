import { AuthControls } from "@/components/AuthControls";
import { ThemeToggle } from "@/components/ThemeToggle";

/** 모든 화면 상단: "비공식 팬 프로젝트" 고지 + 서비스 이름 + 테마 버튼 (DESIGN-UI 1장). */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-card">
      <p className="bg-table-head px-4 py-1 text-center text-xs text-fg-sub">비공식 팬 프로젝트</p>
      <div className="mx-auto flex w-full max-w-[980px] items-center justify-between px-4 py-3">
        <span className="font-num text-lg font-semibold tracking-wide text-fg">SRPFreaks</span>
        <div className="flex items-center gap-2">
          <AuthControls />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
