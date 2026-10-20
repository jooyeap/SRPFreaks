"use client";

import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { UsersAdminView } from "@/components/admin/UsersAdminView";

/** 사용자·역할 관리 화면 (ROOT 전용). */
export default function UsersAdminPage() {
  const t = useTranslations();
  return <AdminGate title={t("Admin.usersTitle")}>{(viewerId) => <UsersAdminView viewerId={viewerId} />}</AdminGate>;
}
