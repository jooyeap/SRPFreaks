"use client";

import { useAuth } from "@/components/AuthProvider";
import { NoticesView } from "@/components/notices/NoticesView";
import { canSeeAdminMenu } from "@/lib/admin";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
import { useTranslations } from "next-intl";

/** 공지사항 화면: /notices. 누구나(로그인 없이도, D43) 읽고, ADMIN·ROOT는 쓰기·고치기·삭제도 한다. */
export default function NoticesPage() {
  const t = useTranslations();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  return <NoticesView viewerId={user?.id ?? ANONYMOUS_VIEWER_ID} canWrite={user !== null && canSeeAdminMenu(user.role)} />;
}
