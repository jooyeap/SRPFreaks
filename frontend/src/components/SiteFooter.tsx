import Link from "next/link";
import { useTranslations } from "next-intl";
import { ContactLine } from "@/components/ContactLine";
import { TableCredit } from "@/components/TableCredit";
import { BUILD_SHA } from "@/lib/build-info";

/**
 * 모든 화면 하단 고지 (DESIGN-UI 1장). 공식 서비스로 오해되지 않도록 항상 보이게 둔다.
 * 왼쪽은 "누구의 사이트인가"(비공식 고지, 권리 문구), 오른쪽은 "연락·출처·약관"(서열표 정보 제공, 문의·삭제, 처리방침)으로 나눠 정보가 한쪽에 몰리지 않게 한다.
 * 좁은 화면(모바일)에서는 두 묶음이 위아래로 쌓이고 둘 다 왼쪽 정렬이다.
 */
export function SiteFooter() {
  const t = useTranslations("Footer");
  const tc = useTranslations("Common");
  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-4 text-xs text-fg-dim sm:flex-row sm:justify-between sm:gap-8">
        <div className="space-y-1">
          <p className="font-semibold text-fg-sub">{tc("unofficial")}</p>
          <p>{t("notKonami")}</p>
          <p>{t("rights")}</p>
          {/* 배포가 반영됐는지 화면에서 바로 확인하는 용도. 언어와 무관한 값이라 번역하지 않는다 */}
          <p className="font-num text-[11px]">build {BUILD_SHA}</p>
        </div>
        <div className="space-y-1 sm:text-right">
          <TableCredit />
          <ContactLine />
          <p className="space-x-3">
            <Link href="/terms" className="underline underline-offset-2 hover:text-fg">
              {t("terms")}
            </Link>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
              {t("privacy")}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
