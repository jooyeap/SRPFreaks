"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { ChartStatsDetailView } from "@/components/admin/ChartStatsDetailView";
import { parseId } from "@/lib/songs";

/** 서열표 분석의 곡 하나 상세: /admin/chart-stats/{채보 id} (D77, ADMIN·ROOT). 주소의 값은 검사해서 쓴다(올바른 숫자가 아니면 안내만). */
export default function ChartStatsDetailPage() {
  const t = useTranslations();
  const params = useParams<{ chartId: string }>();
  const chartId = parseId(params.chartId);
  return (
    <AdminGate title={t("ChartStats.title")} minRole="ADMIN">
      {(viewerId) =>
        chartId === null ? (
          <p role="alert" className="text-sm text-fg">
            {t("ChartStats.loadFailed")}
          </p>
        ) : (
          <ChartStatsDetailView viewerId={viewerId} chartId={chartId} />
        )
      }
    </AdminGate>
  );
}
