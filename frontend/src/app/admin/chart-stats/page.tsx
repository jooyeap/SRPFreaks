"use client";

import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { ChartStatsView } from "@/components/admin/ChartStatsView";

/** 서열표 분석 화면 (D77, ADMIN·ROOT). 읽기 전용 숫자 도구다. */
export default function ChartStatsPage() {
  const t = useTranslations();
  return (
    <AdminGate title={t("ChartStats.title")} minRole="ADMIN">
      {(viewerId) => <ChartStatsView viewerId={viewerId} />}
    </AdminGate>
  );
}
