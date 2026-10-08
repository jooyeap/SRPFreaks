"use client";

import { AdminGate } from "@/components/admin/AdminGate";
import { AuditLogView } from "@/components/admin/AuditLogView";

/** 감사 로그 화면 (ROOT 전용). */
export default function AuditLogsPage() {
  return <AdminGate title="감사 로그">{(viewerId) => <AuditLogView viewerId={viewerId} />}</AdminGate>;
}
