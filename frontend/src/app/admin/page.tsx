"use client";

import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminMenu } from "@/components/admin/AdminMenu";

/** 관리 메뉴 화면 (ADMIN, ROOT). 항목은 역할에 맞는 것만 보인다. */
export default function AdminPage() {
  const t = useTranslations();
  return <AdminGate title={t("Admin.title")} minRole="ADMIN">
      {(_viewerId, role) => <AdminMenu role={role} />}
    </AdminGate>;
}
