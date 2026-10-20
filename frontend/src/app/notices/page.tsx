"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { NoticesView } from "@/components/notices/NoticesView";
import { canSeeAdminMenu } from "@/lib/admin";
import { useTranslations } from "next-intl";

/** 공지사항 화면: /notices. 로그인한 사용자만 읽고, ADMIN·ROOT는 쓰기·고치기·삭제도 한다. */
export default function NoticesPage() {
  const t = useTranslations();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Home.noticesAria")}</h1>
        <p className="text-sm text-fg-sub">{t("Pages.noticesLead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Nav.login")}
        </Link>
      </section>
    );
  }
  return <NoticesView viewerId={user.id} canWrite={canSeeAdminMenu(user.role)} />;
}
