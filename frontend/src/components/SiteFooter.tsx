import Link from "next/link";
import { ContactLine } from "@/components/ContactLine";
import { TableCredit } from "@/components/TableCredit";

/**
 * 모든 화면 하단 고지 (DESIGN-UI 1장). 공식 서비스로 오해되지 않도록 항상 보이게 둔다.
 * 왼쪽은 "누구의 사이트인가"(비공식 고지, 권리 문구), 오른쪽은 "연락·출처·약관"(서열표 정보 제공, 문의·삭제, 처리방침)으로 나눠 정보가 한쪽에 몰리지 않게 한다.
 * 좁은 화면(모바일)에서는 두 묶음이 위아래로 쌓이고 둘 다 왼쪽 정렬이다.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 px-4 py-4 text-xs text-fg-dim sm:flex-row sm:justify-between sm:gap-8">
        <div className="space-y-1">
          <p className="font-semibold text-fg-sub">비공식 팬 프로젝트</p>
          <p>KONAMI와 무관한 팬 사이트입니다.</p>
          <p>곡·음원·게임 화면·명칭 등 모든 저작권과 상표 등 권리는 KONAMI에 있습니다.</p>
        </div>
        <div className="space-y-1 sm:text-right">
          <TableCredit />
          <ContactLine />
          <p>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
              개인정보 처리방침
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
