"use client";

import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { SettingsAdminView } from "@/components/admin/SettingsAdminView";

/** 운영 설정 화면 (ROOT 전용). */
export default function SettingsAdminPage() {
  const t = useTranslations();
  return <AdminGate title={t("Admin.settingsTitle")}>{(viewerId) => <SettingsAdminView viewerId={viewerId} />}</AdminGate>;
}
