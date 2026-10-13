"use client";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminMenu } from "@/components/admin/AdminMenu";

/** 관리 메뉴 화면 (ADMIN, ROOT). 항목은 역할에 맞는 것만 보인다. */
export default function AdminPage() {
  return <AdminGate title="관리" minRole="ADMIN">
      {(_viewerId, role) => <AdminMenu role={role} />}
    </AdminGate>;
}
