"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { WithdrawForm } from "@/components/settings/WithdrawForm";
import { useTranslations } from "next-intl";

/** 회원 탈퇴 확인 화면. 내 계정을 지우는 화면이므로 로그인이 필요하다. */
export default function WithdrawPage() {
  const t = useTranslations();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex min-h-[40svh] flex-col items-start justify-center gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Pages.withdrawTitle")}</h1>
        <p className="text-sm text-fg-sub">{t("Pages.withdrawLead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Nav.login")}
        </Link>
      </section>
    );
  }
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-sm text-fg-sub hover:text-fg">
          &#9666; {t("Nav.settings")}
        </Link>
        <h1 className="text-xl font-semibold text-fg">{t("Pages.withdrawTitle")}</h1>
      </div>
      <WithdrawForm />
    </section>
  );
}
