"use client";

import { AdminGate } from "@/components/admin/AdminGate";
import { SuggestionsAdminView } from "@/components/admin/SuggestionsAdminView";

/** 건의 관리 화면 (ADMIN, ROOT). */
export default function SuggestionsAdminPage() {
  return (
    <AdminGate title="건의 관리" minRole="ADMIN">
      {(viewerId) => <SuggestionsAdminView viewerId={viewerId} />}
    </AdminGate>
  );
}
