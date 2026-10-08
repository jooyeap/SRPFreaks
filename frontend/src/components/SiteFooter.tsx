import Link from "next/link";
import { ContactLine } from "@/components/ContactLine";
import { TableCredit } from "@/components/TableCredit";

/** 모든 화면 하단 고지 (DESIGN-UI 1장). 공식 서비스로 오해되지 않도록 항상 보이게 둔다. 서열표 정보 제공자 표기도 여기에 둔다. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto w-full max-w-[980px] space-y-1 px-4 py-4 text-xs text-fg-dim">
        <p className="font-semibold text-fg-sub">비공식 팬 프로젝트</p>
        <p>KONAMI와 무관한 팬 사이트입니다.</p>
        <p>곡·음원·게임 화면·명칭 등 모든 저작권과 상표 등 권리는 KONAMI에 있습니다.</p>
        <TableCredit />
        <ContactLine />
        <p>
          <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
            개인정보 처리방침
          </Link>
        </p>
      </div>
    </footer>
  );
}
