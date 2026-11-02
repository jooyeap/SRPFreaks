"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { useTranslations } from "next-intl";

/**
 * 홈. 로그인하지 않았으면 서비스 소개와 로그인 안내, 로그인했으면 내 요약(레이팅·서열표 진행도)을 보여 준다.
 * 서열표/레이팅 등 개별 화면은 로그인이 필요하며, 로그인하지 않았으면 각 화면이 로그인 안내를 보여 준다.
 */
export default function Home() {
  const t = useTranslations("Home");
  const tc = useTranslations("Common");
  const tn = useTranslations("Nav");
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{tc("loading")}</p>;
  }
  if (status === "authenticated" && user) {
    return <HomeDashboard userId={user.id} name={user.nickname ?? t("defaultName")} />;
  }
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4">
        <h1 className="font-num text-xl font-semibold">SRPFreaks</h1>
        <p className="mt-2 text-sm text-fg-sub">
          {t("landingLead")}
        </p>
        <p className="mt-2 text-xs text-fg-dim">{t("landingNote")}</p>
        <Link
          href="/login"
          className="mt-3 inline-block min-h-11 rounded-lg border border-ctl px-4 py-1.5 text-sm text-fg hover:bg-table-head"
        >
          {tn("login")}
        </Link>
      </section>

      <ul className="grid gap-3 md:grid-cols-3">
        <li className="rounded-lg border border-line bg-card p-4">
          <p className="text-base font-semibold text-fg">{t("landingTableTitle")}</p>
          <p className="mt-1 text-sm text-fg-sub">{t("landingTableDesc")}</p>
        </li>
        <li className="rounded-lg border border-line bg-card p-4">
          <p className="text-base font-semibold text-fg">{t("landingRatingTitle")}</p>
          <p className="mt-1 text-sm text-fg-sub">{t("landingRatingDesc")}</p>
        </li>
        <li className="rounded-lg border border-line bg-card p-4">
          <p className="text-base font-semibold text-fg">{t("landingInputTitle")}</p>
          <p className="mt-1 text-sm text-fg-sub">{t("landingInputDesc")}</p>
        </li>
      </ul>
    </div>
  );
}
