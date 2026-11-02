"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { NicknameForm } from "@/components/settings/NicknameForm";
import { canSeeAdminMenu } from "@/lib/admin";
import { canUseImport } from "@/lib/features";
import { ProfileVisibilityForm } from "@/components/settings/ProfileVisibilityForm";
import { RivalNotifyForm } from "@/components/settings/RivalNotifyForm";
import { JacketDisplayForm } from "@/components/settings/JacketDisplayForm";
import { useTranslations } from "next-intl";

/** 설정 화면: 계정 정보, 닉네임, 유저 목록 공개 여부, 로그아웃, 탈퇴로 가는 링크. 내 정보이므로 로그인이 필요하다. */
export default function SettingsPage() {
  const t = useTranslations();
  const { status, user, logout } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex min-h-[40svh] flex-col items-start justify-center gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Nav.settings")}</h1>
        <p className="text-sm text-fg-sub">{t("SettingsPage.lead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-ctl px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Nav.login")}
        </Link>
      </section>
    );
  }
  const card = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
  return (
    // 모바일은 폭 448px(max-w-md) 한 열, 데스크톱(md 이상)은 시안대로 760px까지 넓힌다
    <section className="mx-auto flex w-full max-w-md flex-col gap-3 md:max-w-[760px]">
      <h1 className="text-xl font-semibold text-fg">{t("Nav.settings")}</h1>
      <section aria-label={t("SettingsPage.account")} className={card}>
        <h2 className="text-xs font-bold text-fg-sub">{t("SettingsPage.account")}</h2>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-sub">{t("SettingsPage.loginMethod")}</span>
          <span className="font-bold text-fg">Google</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="shrink-0 text-fg-sub">{t("SettingsPage.email")}</span>
          <span className="min-w-0 truncate font-bold text-fg">{user.email}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-sub">{t("SettingsPage.role")}</span>
          <span className="font-bold text-fg">{user.role}</span>
        </div>
        <p className="text-xs leading-relaxed text-fg-dim">{t("SettingsPage.noPassword")}</p>
      </section>
      <section aria-label={t("SettingsPage.nicknameAria")} className={card}>
        <NicknameForm initialNickname={user.nickname} />
      </section>
      <section aria-label={t("SettingsPage.visibilityAria")} className={card}>
        <ProfileVisibilityForm user={user} />
      </section>
      <section aria-label={t("Settings.rivalNotifyHeading")} className={card}>
        <RivalNotifyForm user={user} />
      </section>
      <JacketDisplayForm />
      {canUseImport(user.role) ? (
        <section aria-label={t("Nav.import")} className={card}>
          <h2 className="text-xs font-bold text-fg-sub">{t("Nav.import")}</h2>
          <p className="text-xs leading-relaxed text-fg-sub">{t("SettingsPage.importLead")}</p>
          <Link
            href="/import"
            className="flex h-11 items-center justify-center rounded-xl border border-ctl text-sm font-bold text-fg-sub hover:text-fg"
          >
            {t("SettingsPage.importBtn")}
          </Link>
        </section>
      ) : null}
      {canSeeAdminMenu(user.role) ? (
        <section aria-label={t("Nav.admin")} className={card}>
          <h2 className="text-xs font-bold text-fg-sub">{t("Nav.admin")}</h2>
          <Link
            href="/admin"
            className="flex h-11 items-center justify-center rounded-xl border border-ctl text-sm font-bold text-fg-sub hover:text-fg"
          >
            {t("SettingsPage.adminBtn")}
          </Link>
        </section>
      ) : null}
      <section aria-label={t("SettingsPage.loginState")} className={card}>
        <h2 className="text-xs font-bold text-fg-sub">{t("SettingsPage.loginState")}</h2>
        <button
          type="button"
          onClick={() => void logout()}
          className="h-11 rounded-xl border border-ctl text-sm font-bold text-fg-sub hover:text-fg"
        >
          {t("Nav.logout")}
        </button>
      </section>
      <section aria-label={t("Pages.withdrawTitle")} className="flex flex-col gap-3 rounded-2xl border border-danger bg-card p-4">
        <h2 className="text-xs font-bold text-danger">{t("Pages.withdrawTitle")}</h2>
        <p className="text-xs leading-relaxed text-fg-sub">{t("SettingsPage.withdrawLead")}</p>
        <Link
          href="/settings/withdraw"
          className="flex h-11 items-center justify-center rounded-xl border border-danger text-sm font-extrabold text-danger hover:bg-table-head"
        >
          {t("Settings.withdrawBtn")}
        </Link>
      </section>
    </section>
  );
}
