"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PlayerDetailView } from "@/components/players/PlayerDetailView";
import { canSeeAdminMenu } from "@/lib/admin";
import { parseId } from "@/lib/songs";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
import { useTranslations } from "next-intl";

/**
 * 유저 상세 화면: /players/{유저 id}. 주소의 값은 사용자가 바꿀 수 있으므로 올바른 숫자인지 먼저 검사한다.
 * 숫자라도 공개하지 않았거나 없는 유저면 서버가 404를 준다.
 */
export default function PlayerDetailPage() {
  const t = useTranslations();
  const params = useParams<{ userId: string }>();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  const playerId = parseId(params.userId);
  if (playerId === null) {
    return <p role="alert" className="text-sm text-fg">{t("Players.notFound")}</p>;
  }
  return <PlayerDetailView viewerId={user?.id ?? ANONYMOUS_VIEWER_ID} playerId={playerId} canDeleteRecords={user !== null && canSeeAdminMenu(user.role)} />;
}
