"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { HelpTip } from "@/components/HelpTip";
import { Pager } from "@/components/Pager";
import { ChartCell, DeviationBar, ListState, StatCell, TableHead } from "@/components/admin/ChartStatsParts";
import { FolderCurve } from "@/components/admin/FolderCurve";
import { Segment } from "@/components/rivals/Segment";
import {
  averageText,
  CHART_STATS_TABS,
  chartStatsKeys,
  DEVIATION_SORTS,
  fetchDeviation,
  fetchFolders,
  fetchPopularity,
  fetchUndecided,
  POPULARITY_RANGES,
  ratioPercent,
  signedText,
  tierText,
  type ChartStatsMeta,
  type ChartStatsTab,
  type DeviationSort,
  type PopularityRange,
} from "@/lib/chart-stats";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";

/** 서버 응답이 오기 전에 쓰는 기준값. 서버의 ChartStatsCalculator 상수와 같다(응답의 meta가 오면 그 값을 쓴다). */
const DEFAULT_META: ChartStatsMeta = { publicUsers: 0, minPlayers: 3, minFolderCharts: 3, recentDays: 7 };

// 1024px 이상의 표 형태: 열 크기. 모바일에서는 줄이 곡 이름 아래에 숫자가 이어지는 두 줄 카드다.
const DEVIATION_COLUMNS = "lg:grid-cols-[minmax(0,1fr)_80px_88px_104px_104px_160px]";
const POPULARITY_COLUMNS = "lg:grid-cols-[minmax(0,1fr)_88px_88px_104px_160px]";
const FOLDER_COLUMNS = "lg:grid-cols-[96px_minmax(0,1fr)_120px_140px]";
const UNDECIDED_COLUMNS = "lg:grid-cols-[minmax(0,1fr)_96px_96px]";
const ROW_BASE = "flex flex-col gap-1.5 px-4 py-3 lg:grid lg:items-center lg:gap-3";
const STATS_WRAP = "flex flex-wrap items-center gap-x-3 gap-y-0.5 lg:contents";

/**
 * 서열표 분석 (D77, ROOT·ADMIN). 관리자가 플레이어 기록을 근거로 서열표를 조정하도록 곡별 숫자를 보여 주는 읽기 전용 도구다.
 * 탭 4개: 편차 / 인기 / 폴더 곡선 / 미정. 곡 이름을 누르면 그 곡의 유저별 상세(/admin/chart-stats/{id})로 간다.
 *
 * 판정하지 않는다: 쉬움/어려움 후보, 역전, 적정 같은 말도, 경고 색도 없다. 숫자(+/− 부호 포함)·막대·정렬만 있다. 판정은 관리자가 한다.
 * 공개 프로필을 선택한 유저의 기록만 집계한 값이다(서버가 보장). 플레이어 3명 미만 곡은 「표본 부족」으로 보인다.
 */
export function ChartStatsView({ viewerId }: { viewerId: number }) {
  const t = useTranslations("ChartStats");
  const [tab, setTab] = useState<ChartStatsTab>("deviation");
  // 머리의 안내는 폴더 목록의 집계 기준(meta)을 쓴다. 폴더 탭과 같은 조회라서 요청이 한 번뿐이다.
  const folders = useQuery({
    queryKey: chartStatsKeys.folders(viewerId),
    queryFn: ({ signal }) => fetchFolders(signal),
    staleTime: 60_000,
  });
  const meta = folders.data?.meta ?? DEFAULT_META;
  const tabLabels: Record<ChartStatsTab, string> = {
    deviation: t("tabDeviation"),
    popularity: t("tabPopularity"),
    folders: t("tabFolders"),
    undecided: t("tabUndecided"),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <AdminBackLink />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-fg">{t("title")}</h1>
          <HelpTip
            title={t("helpTitle")}
            ariaLabel={t("helpAria")}
            body={t("helpBody", { min: meta.minPlayers, minFolder: meta.minFolderCharts })}
          />
        </div>
        {folders.data ? <p className="text-sm text-fg-sub">{t("lead", { users: meta.publicUsers })}</p> : null}
      </div>

      <div role="tablist" aria-label={t("tabsAria")} className="flex border-b border-line">
        {CHART_STATS_TABS.map((value) => {
          const selected = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              id={`chart-stats-tab-${value}`}
              aria-selected={selected}
              aria-controls="chart-stats-panel"
              onClick={() => setTab(value)}
              className={`-mb-px min-h-11 flex-1 whitespace-nowrap border-b-2 px-1 text-sm ${
                selected ? "border-[var(--stage-ss-bar)] font-bold text-fg" : "border-transparent text-fg-sub hover:text-fg"
              }`}
            >
              {tabLabels[value]}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="chart-stats-panel" aria-labelledby={`chart-stats-tab-${tab}`} className="flex flex-col gap-3">
        {tab === "deviation" ? <DeviationTab viewerId={viewerId} /> : null}
        {tab === "popularity" ? <PopularityTab viewerId={viewerId} /> : null}
        {tab === "folders" ? <FoldersTab viewerId={viewerId} /> : null}
        {tab === "undecided" ? <UndecidedTab viewerId={viewerId} /> : null}
      </div>
    </div>
  );
}

function DeviationTab({ viewerId }: { viewerId: number }) {
  const t = useTranslations("ChartStats");
  const [sort, setSort] = useState<DeviationSort>("deviation");
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page);
  const query = useQuery({
    queryKey: chartStatsKeys.deviation(viewerId, sort, page),
    queryFn: ({ signal }) => fetchDeviation(sort, page, signal),
    placeholderData: keepPreviousData,
  });
  const sortText: Record<DeviationSort, string> = { deviation: t("sortDeviation"), avg: t("sortAvg"), players: t("sortPlayers") };
  const rows = query.data?.content ?? [];

  return (
    <>
      <Segment
        label={t("sortAria")}
        items={DEVIATION_SORTS.map((value) => ({ value, text: sortText[value] }))}
        value={sort}
        onChange={(next) => {
          setSort(next);
          setPage(0);
        }}
        nowrap
      />
      <ListState
        pending={query.isPending}
        error={query.isError}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={query.isSuccess && rows.length === 0}
        emptyText={t("empty")}
      >
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <TableHead columns={DEVIATION_COLUMNS} labels={[t("colChart"), t("colPlayers"), t("colAvg"), t("colFolderAvg"), t("colDeviation"), ""]} />
          <ul aria-label={t("listAria")} className="divide-y divide-row-line">
            {rows.map((row) => (
              <li key={row.chart.songDifficultyId} className={`${ROW_BASE} ${DEVIATION_COLUMNS}`}>
                <ChartCell chart={row.chart} />
                <div className={STATS_WRAP}>
                  <StatCell label={t("colPlayers")}>{t("playersValue", { n: row.players })}</StatCell>
                  <StatCell label={t("colAvg")} muted={row.avgRate === null}>
                    {averageText(row.avgRate) ?? t("insufficient")}
                  </StatCell>
                  <StatCell label={t("colFolderAvg")} muted={row.folderAvgRate === null}>
                    {averageText(row.folderAvgRate) ?? t("folderInsufficient")}
                    {row.folderAvgRate !== null ? <span className="text-fg-dim"> ({t("folderSample", { n: row.folderSampleCharts })})</span> : null}
                  </StatCell>
                  <StatCell label={t("colDeviation")}>
                    <strong className="font-bold">{signedText(row.deviation) ?? "–"}</strong>
                  </StatCell>
                  <div className="w-full basis-full lg:basis-auto">
                    <DeviationBar value={row.deviation} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Pager page={query.data?.page ?? 0} totalPages={query.data?.totalPages ?? 1} onChange={setPage} />
      </ListState>
    </>
  );
}

function PopularityTab({ viewerId }: { viewerId: number }) {
  const t = useTranslations("ChartStats");
  const [range, setRange] = useState<PopularityRange>("all");
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page);
  const query = useQuery({
    queryKey: chartStatsKeys.popularity(viewerId, range, page),
    queryFn: ({ signal }) => fetchPopularity(range, page, signal),
    placeholderData: keepPreviousData,
  });
  const rangeText: Record<PopularityRange, string> = { all: t("rangeAll"), "7d": t("range7d") };
  const rows = query.data?.content ?? [];
  // 막대는 이 쪽(페이지)에서 가장 큰 값 대비 길이(장식). 값은 글자가 전한다.
  const maxBy = (pick: (row: (typeof rows)[number]) => number) => Math.max(0, ...rows.map(pick));
  const barMax = range === "all" ? maxBy((r) => r.records) : maxBy((r) => r.recentRecords);

  return (
    <>
      <Segment
        label={t("rangeAria")}
        items={POPULARITY_RANGES.map((value) => ({ value, text: rangeText[value] }))}
        value={range}
        onChange={(next) => {
          setRange(next);
          setPage(0);
        }}
      />
      <ListState
        pending={query.isPending}
        error={query.isError}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={query.isSuccess && rows.length === 0}
        emptyText={t("empty")}
      >
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <TableHead columns={POPULARITY_COLUMNS} labels={[t("colChart"), t("colRecords"), t("colPlayers"), t("colRecent"), ""]} />
          <ul aria-label={t("listAria")} className="divide-y divide-row-line">
            {rows.map((row) => (
              <li key={row.chart.songDifficultyId} className={`${ROW_BASE} ${POPULARITY_COLUMNS}`}>
                <ChartCell chart={row.chart} />
                <div className={STATS_WRAP}>
                  <StatCell label={t("colRecords")}>{t("recordsValue", { n: row.records })}</StatCell>
                  <StatCell label={t("colPlayers")}>{t("playersValue", { n: row.players })}</StatCell>
                  <StatCell label={t("colRecent")} muted={row.recentRecords === 0}>
                    {t("recentValue", { n: row.recentRecords })}
                  </StatCell>
                  <div aria-hidden="true" className="h-2 w-full basis-full rounded bg-table-head lg:basis-auto">
                    <div
                      style={{ width: `${ratioPercent(range === "all" ? row.records : row.recentRecords, barMax)}%` }}
                      className="h-full rounded bg-fg-dim"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Pager page={query.data?.page ?? 0} totalPages={query.data?.totalPages ?? 1} onChange={setPage} />
      </ListState>
    </>
  );
}

function FoldersTab({ viewerId }: { viewerId: number }) {
  const t = useTranslations("ChartStats");
  const query = useQuery({
    queryKey: chartStatsKeys.folders(viewerId),
    queryFn: ({ signal }) => fetchFolders(signal),
    staleTime: 60_000,
  });
  const rows = query.data?.content ?? [];

  return (
    <ListState
      pending={query.isPending}
      error={query.isError}
      onRetry={() => void query.refetch()}
      retrying={query.isFetching}
      empty={query.isSuccess && rows.length === 0}
      emptyText={t("empty")}
    >
      <FolderCurve rows={rows} />
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <TableHead columns={FOLDER_COLUMNS} labels={[t("colTier"), t("colCharts"), t("colAvg"), t("colDelta")]} />
        <ul aria-label={t("listAria")} className="divide-y divide-row-line">
          {rows.map((row) => (
            <li key={row.tier} data-tier={tierText(row.tier)} className={`${ROW_BASE} ${FOLDER_COLUMNS}`}>
              <span className="font-num text-sm font-bold text-fg">{tierText(row.tier)}</span>
              <div className={STATS_WRAP}>
                <StatCell label={t("colCharts")}>
                  {t("chartsValue", { n: row.chartCount })}
                  <span className="text-fg-dim"> ({t("folderSample", { n: row.sampledCharts })})</span>
                </StatCell>
                <StatCell label={t("colAvg")} muted={row.avgRate === null}>
                  {averageText(row.avgRate) ?? t("folderInsufficient")}
                </StatCell>
                <StatCell label={t("colDelta")} muted={row.deltaFromPrevious === null}>
                  <strong className="font-bold">{signedText(row.deltaFromPrevious) ?? "–"}</strong>
                </StatCell>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ListState>
  );
}

function UndecidedTab({ viewerId }: { viewerId: number }) {
  const t = useTranslations("ChartStats");
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page);
  const query = useQuery({
    queryKey: chartStatsKeys.undecided(viewerId, page),
    queryFn: ({ signal }) => fetchUndecided(page, signal),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.content ?? [];

  return (
    <ListState
      pending={query.isPending}
      error={query.isError}
      onRetry={() => void query.refetch()}
      retrying={query.isFetching}
      empty={query.isSuccess && rows.length === 0}
      emptyText={t("undecidedEmpty")}
    >
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <TableHead columns={UNDECIDED_COLUMNS} labels={[t("colChart"), t("colRecords"), t("colPlayers")]} />
        <ul aria-label={t("listAria")} className="divide-y divide-row-line">
          {rows.map((row) => (
            <li key={row.chart.songDifficultyId} className={`${ROW_BASE} ${UNDECIDED_COLUMNS}`}>
              <ChartCell chart={row.chart} />
              <div className={STATS_WRAP}>
                <StatCell label={t("colRecords")}>{t("recordsValue", { n: row.records })}</StatCell>
                <StatCell label={t("colPlayers")}>{t("playersValue", { n: row.players })}</StatCell>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <Pager page={query.data?.page ?? 0} totalPages={query.data?.totalPages ?? 1} onChange={setPage} />
    </ListState>
  );
}
