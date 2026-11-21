"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import { Pager } from "@/components/Pager";
import { StageBadge } from "@/components/table/StageBadge";
import {
  averageText,
  bestRateText,
  chartKindText,
  chartStatsHref,
  chartStatsKeys,
  fetchFolderUserRecords,
  tierText,
  type FolderRecord,
  type FolderRecordUnit,
} from "@/lib/chart-stats";
import { kstDate } from "@/lib/folder-distribution";

/**
 * 폴더 기록 상세(D97, ROOT·ADMIN): 점 도표·표에 나온 "한 유저의 폴더 평균"이 어떤 곡의 달성률로 계산됐는지 보여 준다.
 * 맨 위에 계산 근거(`합계 ÷ 곡 수 = 평균`)를 적고, 그 아래에 곡 목록을 둔다. 근거의 곡 수는 점 도표·표의 곡 수(expectedCharts)와 같아야 하며
 * (서버가 같은 조건으로 센다) 그 사이 기록이 바뀌어 어긋나면 안내 한 줄을 붙인다.
 * 같은 폴더에 기록은 있지만 레이팅에 계산되지 않아 평균에서 빠진 곡도 목록에 같이 나오되 `평균 제외` 글자로 구분한다(색·흐림만으로 구분하지 않는다).
 * 열릴 때만 요청한다(이 컴포넌트가 화면에 있을 때만 조회). 판정을 뜻하는 말·색은 없다(D77).
 */
export function FolderUserRecordsPanel({
  viewerId,
  folder,
  unit,
  userId,
  expectedCharts,
  id,
}: {
  viewerId: number;
  /** 묶음의 시작 기준 난이도(0.5 묶음이면 6.0, 6.5 …) */
  folder: number;
  unit: FolderRecordUnit;
  userId: number;
  /** 점 도표·표가 보여 준 곡 수. 서버가 센 곡 수와 비교한다 */
  expectedCharts: number;
  /** 토글 버튼의 aria-controls가 가리키는 id */
  id?: string;
}) {
  const t = useTranslations("ChartStats");
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: chartStatsKeys.folderUserRecords(viewerId, folder, unit, userId, page),
    queryFn: ({ signal }) => fetchFolderUserRecords(folder, unit, userId, page, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const data = query.data;

  let body;
  if (data === undefined && query.isError) {
    body = (
      <ErrorRetry onRetry={() => void query.refetch()} retrying={query.isFetching}>
        {t("recLoadFailed")}
      </ErrorRetry>
    );
  } else if (data === undefined) {
    body = <p className="text-xs text-fg-sub">{t("recLoading")}</p>;
  } else if (data.totalElements === 0) {
    body = <p className="break-keep text-xs text-fg-sub">{t("recEmpty")}</p>;
  } else {
    const range = data.tierFrom === data.tierTo ? tierText(data.tierFrom) : `${tierText(data.tierFrom)}~${tierText(data.tierTo)}`;
    body = (
      <>
        {data.countedCharts > 0 ? (
          <p data-rec-basis="" className="break-keep text-xs text-fg">
            <span className="text-fg-sub">{t("recBasisLabel", { folder: range ?? "" })} </span>
            <span className="font-num font-bold">
              {t("recBasis", { sum: data.sumRate.toFixed(2), n: data.countedCharts, avg: averageText(data.avgRate) ?? "-" })}
            </span>
          </p>
        ) : (
          <p data-rec-basis="" className="break-keep text-xs text-fg-sub">
            {t("recNoCounted")}
          </p>
        )}
        {data.countedCharts !== expectedCharts ? (
          <p data-rec-mismatch="" className="break-keep text-[11px] text-fg-sub">
            {t("recMismatch", { shown: expectedCharts, now: data.countedCharts })}
          </p>
        ) : null}
        {data.excludedCharts > 0 ? (
          <p className="break-keep text-[11px] text-fg-sub">{t("recExcludedNote", { n: data.excludedCharts })}</p>
        ) : null}
        <ul aria-label={t("recListAria", { nickname: data.nickname, folder: range ?? "" })} className="divide-y divide-row-line rounded-lg border border-line bg-card">
          {data.content.map((record) => (
            <RecordRow key={record.chart.songDifficultyId} record={record} />
          ))}
        </ul>
        <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} />
      </>
    );
  }

  return (
    <div id={id} data-folder-records="" className="mt-2 flex flex-col gap-1.5">
      {body}
    </div>
  );
}

/**
 * 곡 한 줄(360px 기준 두 줄): 위 = 곡명(상세 링크) · 달성 단계 글자, 아래 = 파트·난이도·기준 난이도 · 달성률 · 저장일.
 * 평균 제외 곡은 `평균 제외` 글자를 붙이고 값은 그대로 보여 준다. 곡명은 길면 줄을 바꾼다(잘라 내지 않는다).
 */
function RecordRow({ record }: { record: FolderRecord }) {
  const t = useTranslations("ChartStats");
  const { chart } = record;
  return (
    <li data-rec-row={chart.songDifficultyId} data-counted={record.counted ? "true" : "false"} className="flex flex-col gap-0.5 px-2.5 py-1.5">
      <div className="flex items-start gap-1.5">
        <Link
          href={chartStatsHref(chart.songDifficultyId)}
          aria-label={t("openChartAria", { title: chart.title })}
          className="min-w-0 flex-1 break-all text-xs font-bold text-fg hover:underline"
        >
          {chart.title}
        </Link>
        <StageBadge stage={record.stage} />
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-num text-[11px] text-fg-sub">
        <span>
          {chartKindText(chart)} · {tierText(chart.tier) ?? t("undecided")}
        </span>
        <span className="font-bold text-fg">{bestRateText(record.bestRate)}</span>
        <span className="text-fg-dim">{t("recSavedOn", { date: kstDate(record.savedAt) ?? "-" })}</span>
        {record.counted ? null : <span className="rounded border border-line px-1 text-[10px] text-fg-sub">{t("recNotCounted")}</span>}
      </p>
    </li>
  );
}
