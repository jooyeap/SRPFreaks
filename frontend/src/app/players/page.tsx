"use client";

import { useAuth } from "@/components/AuthProvider";
import { PlayerListView } from "@/components/players/PlayerListView";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
import { useTranslations } from "next-intl";

/** 유저 목록 화면. 로그인 없이도 볼 수 있다(D43). 공개를 선택한 유저만 나온다. */
export default function PlayersPage() {
  const t = useTranslations();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  return <PlayerListView viewerId={user?.id ?? ANONYMOUS_VIEWER_ID} />;
}
