import Link from "next/link";
import { useTranslations } from "next-intl";
import { ContactLine } from "@/components/ContactLine";
import { TableCredit } from "@/components/TableCredit";
import { BUILD_SHA } from "@/lib/build-info";
import { FOOTER_LINE_LINK } from "@/lib/hit-area";

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
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-16 pt-4 text-xs text-fg-dim sm:flex-row sm:pb-4 sm:justify-between sm:gap-8">
        <div className="space-y-1">
          <p className="font-semibold text-fg-sub">{tc("unofficial")}</p>
          <p>{t("notKonami")}</p>
          <p>{t("rights")}</p>
          {/* 배포가 반영됐는지 화면에서 바로 확인하는 용도. 언어와 무관한 값이라 번역하지 않는다 */}
          <p className="font-num text-[11px]">build {BUILD_SHA}</p>
        </div>
        <div className="space-y-1 sm:text-right">
          {/* 줄마다 링크가 높이 44px(FOOTER_LINE_LINK)라 줄 간격이 예전보다 넓다. 푸터에서만 레이아웃이 달라진다 */}
          <TableCredit tall />
          <ContactLine tall />
          <p className="flex flex-wrap items-center gap-x-3 sm:justify-end">
            <Link href="/terms" className={`underline underline-offset-2 hover:text-fg ${FOOTER_LINE_LINK}`}>
              {t("terms")}
            </Link>
            <Link href="/privacy" className={`underline underline-offset-2 hover:text-fg ${FOOTER_LINE_LINK}`}>
              {t("privacy")}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
