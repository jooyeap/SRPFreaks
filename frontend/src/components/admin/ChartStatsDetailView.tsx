"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";
import { Pager } from "@/components/Pager";
import { DeviationBar, ListState, StatCell, TableHead } from "@/components/admin/ChartStatsParts";
import { Segment, TierChip } from "@/components/rivals/Segment";
import {
  averageText,
  bestRateText,
  chartKindText,
  chartStatsKeys,
  fetchChartPlayers,
  fetchChartSummary,
  PLAYER_SORTS,
  signedText,
  tierText,
  type PlayerSort,
} from "@/lib/chart-stats";
import { formatPlayedDate, formatScore } from "@/lib/format";
import { HIT_ROW } from "@/lib/hit-area";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";

const PLAYER_COLUMNS = "lg:grid-cols-[minmax(0,1fr)_120px_104px_104px_88px_112px]";

/**
 * 곡 하나의 유저별 상세 (D77, ROOT·ADMIN): 맨 위에 집계 요약(인원·기록 수·평균·중앙값·폴더 평균·편차), 아래에 이 곡을 기록한 공개 유저 목록.
 * 닉네임을 누르면 그 유저의 기존 공개 상세(/players/{id})로 간다(새 상세 화면을 만들지 않는다). 목록의 닉네임·티어·총점은 유저 목록(D26)에서 이미 보이는 값이다.
 * 판정은 하지 않는다. 숫자와 정렬만 있다.
 */
export function ChartStatsDetailView({ viewerId, chartId }: { viewerId: number; chartId: number }) {
  const t = useTranslations("ChartStats");
  const summary = useQuery({
    queryKey: chartStatsKeys.summary(viewerId, chartId),
    queryFn: ({ signal }) => fetchChartSummary(chartId, signal),
  });
  const data = summary.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/admin/chart-stats" aria-label={t("detailBackAria")} title={t("detailBackAria")} className={BACK_BUTTON_CLASS}>
          <BackArrow />
        </Link>
        {data ? (
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-fg">{data.chart.title}</h1>
            <p className="font-num text-xs text-fg-dim">
              {chartKindText(data.chart)} · {tierText(data.chart.tier) ?? t("undecided")}
            </p>
          </div>
        ) : (
          <h1 className="text-xl font-semibold text-fg">{t("title")}</h1>
        )}
      </div>

      <ListState
        pending={summary.isPending}
        error={summary.isError}
        onRetry={() => void summary.refetch()}
        retrying={summary.isFetching}
        empty={false}
        emptyText=""
      >
        {data ? (
          <section aria-label={t("summaryTitle")} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5">
            <h2 className="text-[13px] font-bold text-fg">{t("summaryTitle")}</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
              <Item label={t("colPlayers")} value={t("playersValue", { n: data.players })} />
              <Item label={t("colRecords")} value={t("recordsValue", { n: data.records })} />
              <Item label={t("colAvg")} value={averageText(data.avgRate) ?? t("insufficient")} muted={data.avgRate === null} />
              <Item label={t("median")} value={averageText(data.medianRate) ?? t("insufficient")} muted={data.medianRate === null} />
              <Item
                label={t("colFolderAvg")}
                value={
                  data.folderAvgRate === null
                    ? data.chart.tier === null
                      ? t("undecided")
                      : t("folderInsufficient")
                    : `${averageText(data.folderAvgRate)} (${t("folderSample", { n: data.folderSampleCharts })})`
                }
                muted={data.folderAvgRate === null}
              />
              <Item label={t("colDeviation")} value={signedText(data.deviation) ?? "–"} strong />
            </dl>
            <DeviationBar value={data.deviation} />
          </section>
        ) : null}
      </ListState>

      <PlayersSection viewerId={viewerId} chartId={chartId} />
    </div>
  );
}

function Item({ label, value, muted = false, strong = false }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-fg-dim">{label}</dt>
      <dd className={`font-num tabular-nums ${muted ? "text-fg-dim" : "text-fg"} ${strong ? "font-bold" : ""}`}>{value}</dd>
    </div>
  );
}

function PlayersSection({ viewerId, chartId }: { viewerId: number; chartId: number }) {
  const t = useTranslations("ChartStats");
  const [sort, setSort] = useState<PlayerSort>("rate");
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page);
  const query = useQuery({
    queryKey: chartStatsKeys.players(viewerId, chartId, sort, page),
    queryFn: ({ signal }) => fetchChartPlayers(chartId, sort, page, signal),
    placeholderData: keepPreviousData,
  });
  const sortText: Record<PlayerSort, string> = { rate: t("sortRate"), score: t("sortScore"), plays: t("sortPlays") };
  const rows = query.data?.content ?? [];

  return (
    <section aria-label={t("playersTitle")} className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-fg">{t("playersTitle")}</h2>
      <Segment
        label={t("sortAria")}
        items={PLAYER_SORTS.map((value) => ({ value, text: sortText[value] }))}
        value={sort}
        onChange={(next) => {
          setSort(next);
          setPage(0);
        }}
      />
      <ListState
        pending={query.isPending}
        error={query.isError}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={query.isSuccess && rows.length === 0}
        emptyText={t("playersEmpty")}
      >
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <TableHead columns={PLAYER_COLUMNS} labels={["", "", t("colBest"), t("colScore"), t("colPlays"), t("colLast")]} />
          <ul aria-label={t("playersTitle")} className="divide-y divide-row-line">
            {rows.map((row) => (
              <li key={row.userId} className={`flex flex-col gap-1.5 px-4 py-3 lg:grid lg:items-center lg:gap-3 ${PLAYER_COLUMNS}`}>
                <Link
                  href={`/players/${row.userId}`}
                  aria-label={t("openPlayerAria", { nickname: row.nickname })}
                  className={`${HIT_ROW} block text-sm font-bold text-fg hover:underline`}
                >
                  <span className="block truncate">{row.nickname}</span>
                </Link>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 lg:contents">
                  <span>{row.tier ? <TierChip tier={row.tier} /> : <span className="text-fg-dim">–</span>}</span>
                  <StatCell label={t("colBest")}>{bestRateText(row.bestRate)}</StatCell>
                  <StatCell label={t("colScore")}>{formatScore(row.totalScore)}</StatCell>
                  <StatCell label={t("colPlays")}>{t("recordsValue", { n: row.playCount })}</StatCell>
                  <StatCell label={t("colLast")}>{formatPlayedDate(row.lastPlayedAt)}</StatCell>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Pager page={query.data?.page ?? 0} totalPages={query.data?.totalPages ?? 1} onChange={setPage} />
      </ListState>
    </section>
  );
}
