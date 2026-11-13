"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * 비로그인 방문자에게만 보이는 한 줄 안내. 읽기는 로그인 없이 되지만 내 기록·레이팅은 로그인해야 보인다(D43).
 * message: 화면마다 안내 문장을 바꿀 때 쓴다(서열표 폴더의 `로그인하면 내 달성률이 여기에 표시돼요`). 없으면 기본 문장이다. 버튼 모양은 그대로다.
 */
export function LoginBanner({ message }: { message?: string }) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-fg-sub">
      <span>{message ?? t("Songs.loginBanner")}</span>
      <Link href="/login" className="min-h-9 rounded-lg border border-ctl px-3 py-1 text-sm text-fg hover:bg-table-head">
        {t("Nav.login")}
      </Link>
    </div>
  );
}
