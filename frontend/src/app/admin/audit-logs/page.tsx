"use client";

import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { AuditLogView } from "@/components/admin/AuditLogView";

/** 감사 로그 화면 (ROOT 전용). */
export default function AuditLogsPage() {
  const t = useTranslations();
  return <AdminGate title={t("Admin.auditTitle")}>{(viewerId) => <AuditLogView viewerId={viewerId} />}</AdminGate>;
}
