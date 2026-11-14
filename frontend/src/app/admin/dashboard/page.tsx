"use client";

import { useTranslations } from "next-intl";
import { AdminDashboardView } from "@/components/admin/AdminDashboardView";
import { AdminGate } from "@/components/admin/AdminGate";

/** 관리자 대시보드 화면 (D80, ROOT 전용). 읽기 전용 숫자 화면이다. ADMIN은 문지기에서 막히고 서버도 403을 준다. */
export default function DashboardPage() {
  const t = useTranslations();
  return (
    <AdminGate title={t("Dashboard.title")} minRole="ROOT">
      {(viewerId) => <AdminDashboardView viewerId={viewerId} />}
    </AdminGate>
  );
}
