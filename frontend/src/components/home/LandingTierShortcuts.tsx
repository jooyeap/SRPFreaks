"use client";

import Link from "next/link";
import { folderHref, tierParam } from "@/lib/difficulty-table";
import { LANDING_TIER_SHORTCUTS } from "@/lib/landing-home";
import { useTranslations } from "next-intl";

/**
 * 로그인 전 홈의 서열표 바로가기(E2): 5.4 / 5.6 / 5.8 / 6.0 / 미정 폴더로 가는 칩 다섯 개.
 * 데이터를 부르지 않는 고정 링크라 항상 보이고, 주소는 서열표 화면과 같은 folderHref 규칙이다.
 * 로그인하지 않았으면 그 폴더에서 내 기록 칸 없이 곡 목록만 보인다. 글자(`5.4`, `미정`)가 그대로 라벨이라 색에 기대지 않는다.
 * 누르는 영역은 칩 높이 44px(min-h-11)로 확보한다.
 */
export function LandingTierShortcuts() {
  const t = useTranslations("Home");
  const tc = useTranslations("Common");
  return (
    <section aria-label={t("landingShortcutsTitle")} className="flex flex-col gap-2">
      <h2 className="px-1 text-[17px] font-bold text-fg">{t("landingShortcutsTitle")}</h2>
      <ul className="flex flex-wrap gap-2">
        {LANDING_TIER_SHORTCUTS.map((tier) => (
          <li key={tierParam(tier)}>
            <Link
              href={folderHref(tier)}
              className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-lg border border-ctl bg-card px-4 font-num text-sm font-semibold text-fg hover:bg-table-head"
            >
              {tier === null ? tc("undecided") : tier.toFixed(1)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
