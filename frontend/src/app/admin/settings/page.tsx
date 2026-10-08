"use client";

import { AdminGate } from "@/components/admin/AdminGate";
import { SettingsAdminView } from "@/components/admin/SettingsAdminView";

/** 운영 설정 화면 (ROOT 전용). */
export default function SettingsAdminPage() {
  return <AdminGate title="설정">{(viewerId) => <SettingsAdminView viewerId={viewerId} />}</AdminGate>;
}
