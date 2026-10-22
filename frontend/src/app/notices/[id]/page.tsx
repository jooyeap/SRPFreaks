"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { NoticeDetailView } from "@/components/notices/NoticeDetailView";
import { canSeeAdminMenu } from "@/lib/admin";
import { parseId } from "@/lib/songs";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
import { useTranslations } from "next-intl";

/** 공지 상세 화면: /notices/{id}. 주소의 값은 사용자가 바꿀 수 있으므로 올바른 숫자인지 먼저 검사한다. */
export default function NoticeDetailPage() {
  const t = useTranslations();
  const params = useParams<{ id: string }>();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  const noticeId = parseId(params.id);
  if (noticeId === null) {
    return <p role="alert" className="text-sm text-fg">{t("Notices.notFound")}</p>;
  }
  return <NoticeDetailView viewerId={user?.id ?? ANONYMOUS_VIEWER_ID} noticeId={noticeId} canWrite={user !== null && canSeeAdminMenu(user.role)} />;
}
