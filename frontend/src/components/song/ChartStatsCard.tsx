"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import { averageText, chartStatsHref, chartStatsKeys, fetchChartSummary, signedText } from "@/lib/chart-stats";
import { HIT_STANDALONE } from "@/lib/hit-area";

/**
 * 곡 상세의 `플레이어 통계` 카드 (D77). **ROOT·ADMIN에게만** 그린다(호출하는 쪽이 거르고, 서버도 ADMIN 미만은 403이다).
 * 공개 유저들이 이 채보를 기록한 인원·평균·폴더 대비(편차)를 숫자로만 보여 준다. 플레이어가 3명 미만이면 `표본 부족`.
 * 판정은 하지 않는다(쉬움/어려움 같은 말도, 경고 색도 없다). `유저별 상세 보기`가 서열표 분석의 곡 상세(/admin/chart-stats/{id})로 간다.
 *
 * 불러오는 중에는 아무것도 그리지 않는다(PeerStatsCard와 같은 이유: 틀을 먼저 그리면 나타났다 사라지며 화면이 흔들린다). 실패했을 때만 안내와 다시 시도를 보인다.
 */
export function ChartStatsCard({ chartId, viewerId }: { chartId: number; viewerId: number }) {
  const t = useTranslations("ChartStats");
  const query = useQuery({
    queryKey: chartStatsKeys.summary(viewerId, chartId),
    queryFn: ({ signal }) => fetchChartSummary(chartId, signal),
    staleTime: 60_000,
  });
  const data = query.data;
  if (query.isPending) {
    return null;
  }

  return (
    <section aria-label={t("cardTitle")} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5">
      <h2 className="text-[13px] font-bold text-fg">{t("cardTitle")}</h2>
      {query.isError || !data ? (
        <ErrorRetry onRetry={() => void query.refetch()} retrying={query.isFetching}>
          {t("cardLoadFailed")}
        </ErrorRetry>
      ) : (
        <>
          <dl className="flex flex-col gap-1.5 text-[13px]">
            <Row label={t("colPlayers")} value={t("playersValue", { n: data.players })} />
            <Row label={t("colAvg")} value={averageText(data.avgRate) ?? t("insufficient")} muted={data.avgRate === null} />
            <Row
              label={t("colDeviation")}
              value={signedText(data.deviation) ?? (data.avgRate === null ? t("insufficient") : data.chart.tier === null ? t("undecided") : t("folderInsufficient"))}
              muted={data.deviation === null}
              strong={data.deviation !== null}
            />
          </dl>
          <Link href={chartStatsHref(chartId)} className={`${HIT_STANDALONE} self-start text-xs font-bold text-fg-sub hover:text-fg`}>
            {t("cardDetail")}
          </Link>
        </>
      )}
    </section>
  );
}

function Row({ label, value, muted = false, strong = false }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-fg-sub">{label}</dt>
      <dd className={`text-right font-num tabular-nums ${muted ? "text-fg-dim" : "text-fg"} ${strong ? "font-bold" : ""}`}>{value}</dd>
    </div>
  );
}
