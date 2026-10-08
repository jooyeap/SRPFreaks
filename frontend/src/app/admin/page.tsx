"use client";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminMenu } from "@/components/admin/AdminMenu";

/** 관리 메뉴 화면 (ROOT 전용). */
export default function AdminPage() {
  return <AdminGate title="관리">{() => <AdminMenu />}</AdminGate>;
}
