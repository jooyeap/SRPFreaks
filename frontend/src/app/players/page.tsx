"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { PlayerListView } from "@/components/players/PlayerListView";
import { useTranslations } from "next-intl";

/** 유저 목록 화면. 로그인한 사용자만 볼 수 있다(공개를 선택한 유저의 정보이므로). */
export default function PlayersPage() {
  const t = useTranslations();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Players.listTitle")}</h1>
        <p className="text-sm text-fg-sub">{t("Pages.playersLead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Nav.login")}
        </Link>
      </section>
    );
  }
  return <PlayerListView viewerId={user.id} />;
}
