"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";
import { Pager } from "@/components/Pager";
import { ApiError } from "@/lib/api";
import type { RivalChartRow, RivalCounts, RivalRatingRow, RivalResult } from "@/lib/api-types";
import { formatRate } from "@/lib/format";
import { ChartBadge } from "@/components/table/Badges";
import { ChartLine } from "@/components/table/ChartLine";
import { useJackets } from "@/lib/jackets";
import { CatchUpSection } from "@/components/rivals/CatchUpSection";
import { RivalDashboard } from "@/components/rivals/RivalDashboard";
import { CompareScoreAside } from "@/components/rivals/CompareScoreAside";
import { Segment } from "@/components/rivals/Segment";
import { DEFAULT_CHART, DEFAULT_TAB, type DashChart, type DashTab } from "@/lib/rival-dashboard";
import { fetchCompareCharts, fetchCompareRating, rivalKeys, signed } from "@/lib/rivals";
import { useTranslations } from "next-intl";

type View = "rating" | "charts";
type Group = "single" | "other";

const RESULTS: readonly { value: RivalResult; key: "resultWin" | "resultLose" | "resultTie" | "resultTheirs"; count: keyof RivalCounts }[] = [
  { value: "WIN", key: "resultWin", count: "win" },
  { value: "LOSE", key: "resultLose", count: "lose" },
  { value: "TIE", key: "resultTie", count: "tie" },
  { value: "THEIRS_ONLY", key: "resultTheirs", count: "theirsOnly" },
];

/**
 * 레이팅 비교 목록의 한 줄(D65). 서열표·세트리스트와 같은 공통 줄(ChartLine, D64)에 왼쪽 순번과 재킷을 끼운다.
 * 오른쪽 열은 위에서부터 상대 점수(티어 색, 소수는 작게) / `나 238.10`(내 점수) / 차이 칩(내 점수 - 상대 점수).
 * 칩은 `+2.28`(내가 앞, 초록) / `−4.37`(내가 뒤, 주황) / `±0.00`(같음) / `내 기록 없음`이고, 부호·글자가 있어서 색만으로 구분하지 않는다.
 * 점수·차이는 서버가 계산한 값을 그대로 쓴다(화면에서 다시 계산하지 않는다). 재킷은 운영·개인 설정이 켜졌을 때만 칸을 둔다.
 */
function RatingCompareLine({ row, jackets }: { row: RivalRatingRow; jackets: ReturnType<typeof useJackets> }) {
  return (
    <ChartLine
      className="border-t border-row-line first:border-t-0"
      lead={<span className="w-5 shrink-0 text-center font-num text-xs text-fg-dim">{row.rank}</span>}
      jacket={jackets.visible ? { url: jackets.urlOf(row.songId) } : null}
      pattern={row.pattern}
      tier={row.tier}
      title={row.title}
      href={`/songs/${row.songId}?chart=${row.songDifficultyId}`}
      part={row.part}
      difficulty={row.difficulty}
      level={row.level}
      aside={<CompareScoreAside score={row.score} myScore={row.myScore} myRate={row.myRate} rate={row.rate} />}
    />
  );
}

/**
 * 라이벌 비교 화면(D56). 머리: 나 총점 · 승·패·무 · 상대 총점. 보기: 상대 레이팅 목록에 내 점수 나란히 / 곡별 승패.
 * 승패·점수는 서버가 계산한 값을 그대로 쓴다(화면에서 다시 계산하지 않는다).
 */
export function RivalCompareView({
  viewerId,
  targetId,
  initialView = "rating",
  tab: tabProp,
  onTabChange,
  chart: chartProp,
  onChartChange,
}: {
  viewerId: number;
  targetId: number;
  initialView?: View;
  /** 대시보드의 탭·차트. 주소(`?tab=&chart=`)가 쥐는 값이다. 주지 않으면 이 화면이 스스로 갖는다(처음은 우세·막대) */
  tab?: DashTab;
  onTabChange?: (tab: DashTab) => void;
  chart?: DashChart;
  onChartChange?: (chart: DashChart) => void;
}) {
  const t = useTranslations("Rival");
  const tc = useTranslations();
  const [view, setView] = useState<View>(initialView);
  const [group, setGroup] = useState<Group>("single");
  const [result, setResult] = useState<RivalResult>("LOSE");
  const [page, setPage] = useState(0);
  const [localTab, setLocalTab] = useState<DashTab>(DEFAULT_TAB);
  const [localChart, setLocalChart] = useState<DashChart>(DEFAULT_CHART);
  const tab = tabProp ?? localTab;
  const chart = chartProp ?? localChart;
  const jackets = useJackets();

  const rating = useQuery({
    queryKey: rivalKeys.rating(viewerId, targetId),
    queryFn: ({ signal }) => fetchCompareRating(targetId, signal),
    retry: false,
  });
  const charts = useQuery({
    queryKey: [...rivalKeys.charts(viewerId, targetId, result), page],
    queryFn: ({ signal }) => fetchCompareCharts(targetId, result, page, signal),
    enabled: view === "charts" && rating.isSuccess,
    retry: false,
  });

  const back = (
    <Link href={`/players/${targetId}`} aria-label={t("backAria")} title={t("backAria")} className={BACK_BUTTON_CLASS}>
      <BackArrow />
    </Link>
  );

  if (rating.isPending) {
    return <p className="text-sm text-fg-sub">{tc("Common.loading")}</p>;
  }
  if (rating.isError) {
    const notFound = rating.error instanceof ApiError && rating.error.status === 404;
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p role="alert" className="text-sm text-fg">
          {notFound ? tc("Players.notFound") : rating.error instanceof ApiError ? rating.error.message : t("loadFailed")}
        </p>
      </div>
    );
  }
  const data = rating.data;
  const counts = data.counts;
  const rows = group === "single" ? data.single : data.other;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {back}
        <h1 className="min-w-0 truncate text-xl font-semibold text-fg">{t("vsTitle", { nickname: data.nickname })}</h1>
      </div>

      <RivalDashboard
        viewerId={viewerId}
        targetId={targetId}
        rating={data}
        tab={tab}
        onTabChange={(next) => (onTabChange ? onTabChange(next) : setLocalTab(next))}
        chart={chart}
        onChartChange={(next) => (onChartChange ? onChartChange(next) : setLocalChart(next))}
        jackets={jackets}
      />

      <Segment<View>
        label={t("viewAria")}
        items={[{ value: "rating", text: t("viewRating") }, { value: "charts", text: t("viewCharts") }]}
        value={view}
        onChange={setView}
      />

      {view === "rating" ? (
        <section aria-label={t("viewRating")} className="flex flex-col gap-3">
          <CatchUpSection viewerId={viewerId} rows={[...data.single, ...data.other]} jackets={jackets} />
          <Segment<Group>
            label={t("groupAria")}
            items={[{ value: "single", text: t("groupSingle") }, { value: "other", text: t("groupOther") }]}
            value={group}
            onChange={setGroup}
          />
          {rows.length === 0 ? (
            <p className="text-sm text-fg-sub">{t("emptyRating")}</p>
          ) : (
            <ol className="overflow-hidden rounded-2xl border border-line bg-card">
              {rows.map((row) => (
                <RatingCompareLine key={row.songDifficultyId} row={row} jackets={jackets} />
              ))}
            </ol>
          )}
          <p className="text-xs text-fg-dim">{t("ratingLegend")}</p>
        </section>
      ) : (
        <section aria-label={t("viewCharts")} className="flex flex-col gap-3">
          <Segment<RivalResult>
            label={t("resultAria")}
            items={RESULTS.map((r) => ({ value: r.value, text: t(r.key, { n: counts[r.count] }) }))}
            value={result}
            onChange={(next) => {
              setResult(next);
              setPage(0);
            }}
          />
          <p className="text-xs text-fg-dim">{t("chartsOrder")}</p>
          {charts.isPending ? (
            <p className="text-sm text-fg-sub">{tc("Common.loading")}</p>
          ) : charts.isError ? (
            <p role="alert" className="text-sm text-fg">{charts.error instanceof ApiError ? charts.error.message : t("loadFailed")}</p>
          ) : charts.data.page.content.length === 0 ? (
            <p className="text-sm text-fg-sub">{t("emptyCharts")}</p>
          ) : (
            <>
              <ul className="rounded-2xl border border-line bg-card">
                {charts.data.page.content.map((row: RivalChartRow) => (
                  <li key={row.songDifficultyId} className="border-t border-row-line first:border-t-0">
                    <Link href={`/songs/${row.songId}?chart=${row.songDifficultyId}`} className="grid grid-cols-[minmax(0,1fr)_auto_56px] items-center gap-2 px-3 py-2.5 hover:bg-table-head">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-fg">{row.title}</span>
                        <span className="mt-1 flex"><ChartBadge part={row.part} difficulty={row.difficulty} level={row.level} /></span>
                      </span>
                      <span className="text-right font-num text-xs">
                        <span className="block text-fg" aria-label={t("myRateAria")}>{formatRate(row.myRate)}</span>
                        <span className="block text-fg-dim" aria-label={t("theirRateAria", { nickname: data.nickname })}>{formatRate(row.theirRate)}</span>
                      </span>
                      <span className={`text-right font-num text-xs ${row.diff !== null && row.diff > 0 ? "text-done-text" : row.diff !== null && row.diff < 0 ? "text-danger" : "text-fg-dim"}`}>
                        {row.diff === null ? "–" : signed(row.diff)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pager page={page} totalPages={charts.data.page.totalPages} onChange={setPage} />
            </>
          )}
          <p className="text-xs text-fg-dim">{t("chartsLegend", { nickname: data.nickname })}</p>
        </section>
      )}
    </div>
  );
}
