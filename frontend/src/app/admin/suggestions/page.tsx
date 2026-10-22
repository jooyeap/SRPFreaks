"use client";

import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { SuggestionsAdminView } from "@/components/admin/SuggestionsAdminView";

/** 건의 관리 화면 (ADMIN, ROOT). */
export default function SuggestionsAdminPage() {
  const t = useTranslations();
  return (
    <AdminGate title={t("Admin.suggestionsTitle")} minRole="ADMIN">
      {(viewerId) => <SuggestionsAdminView viewerId={viewerId} />}
    </AdminGate>
  );
}
