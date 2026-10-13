"use client";

import { AdminGate } from "@/components/admin/AdminGate";
import { UsersAdminView } from "@/components/admin/UsersAdminView";

/** 사용자·역할 관리 화면 (ROOT 전용). */
export default function UsersAdminPage() {
  return <AdminGate title="사용자">{(viewerId) => <UsersAdminView viewerId={viewerId} />}</AdminGate>;
}
