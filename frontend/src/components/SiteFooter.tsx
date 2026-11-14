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
 *
 * 아래 고정 바(서열표 폴더의 `‹ 5.5 / 5.6 / 5.7 ›`, 곡 상세의 이전/다음)가 있으면 그 높이(--bottom-bar-h)만큼 푸터 아래를 비운다(2026-11-12).
 * 끝까지 내려도 푸터 문구가 바에 가려지지 않는다. 바가 없는 화면은 변수가 없어 0px이라 그대로다. 바는 고정 그대로다.
 * 오른쪽 아래의 `맨 위로` 버튼(오른쪽 12~16px, 폭 36~44px)이 오른쪽 열의 링크(문의 이메일 등)를 가리지 않도록, 화면이 콘텐츠 최대 폭(1200px)에 버튼 자리를 더한 폭보다
 * 좁을 때(640~1340px) 오른쪽 안쪽 여백을 넓혀 글자가 버튼 아래로 들어가지 않게 한다. 더 넓은 화면은 콘텐츠가 가운데에 모여 있어 겹치지 않고, 640px 미만(모바일)은 두 묶음이 쌓이고 마지막 줄이 버튼보다 위에서 끝나 여백이 필요 없다.
 */
export function SiteFooter() {
  const t = useTranslations("Footer");
  const tc = useTranslations("Common");
  return (
    <footer className="border-t border-line bg-card pb-[var(--bottom-bar-h,0px)]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 sm:max-[1340px]:pr-16 pb-16 pt-4 text-xs text-fg-dim sm:flex-row sm:pb-4 sm:justify-between sm:gap-8">
        <div className="space-y-1">
          <p className="font-semibold text-fg-sub">{tc("unofficial")}</p>
          <p>{t("notKonami")}</p>
          <p>{t("rights")}</p>
          {/* 배포가 반영됐는지 화면에서 바로 확인하는 용도. 언어와 무관한 값이라 번역하지 않는다 */}
          <p className="font-num text-[11px]">build {BUILD_SHA}</p>
        </div>
        {/* 모바일: 제공자 줄 + 링크 묶음 한 덩어리(간격 12px = 제공자 링크 터치 영역 아래쪽 12px 자리). sm 이상은 예전처럼 줄마다 따로 쌓고 오른쪽 정렬(간격 4px) */}
        <div className="flex flex-col gap-3 sm:block sm:space-y-1 sm:text-right">
          <TableCredit tall />
          {/* 모바일에서는 이메일·약관·처리방침을 한 묶음으로 모은다(자리가 모자라면 줄바꿈). 링크는 높이 40px 상자(FOOTER_LINE_LINK)라 서로 겹치지 않는다 */}
          <div className="flex flex-wrap items-center gap-x-3 sm:block sm:space-y-1">
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
      </div>
    </footer>
  );
}
