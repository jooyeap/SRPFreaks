"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";
import { Pager } from "@/components/Pager";
import { CompareScoreAside } from "@/components/rivals/CompareScoreAside";
import { Segment } from "@/components/rivals/Segment";
import { ChartLine } from "@/components/table/ChartLine";
import { ApiError } from "@/lib/api";
import type { RivalDetailFilter, RivalPatternKey } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { useJackets } from "@/lib/jackets";
import {
  dashboardKeys,
  DASH_TABS,
  DETAIL_FILTERS,
  DETAIL_PAGE_SIZE,
  type DashTab,
  fetchCompareSummaryDetail,
  isSmallSample,
} from "@/lib/rival-dashboard";
import { formatScoreDiff } from "@/lib/rivals";
import { useTranslations } from "next-intl";

const FILTER_LABEL_KEY = { all: "filterAll", lose: "filterLose", close: "filterClose", win: "filterWin" } as const;

/**
 * 라이벌 대시보드의 속성 상세(D67, 6단계): `/players/{id}/compare/{속성 키}`. 한 속성의 두 사람 공유 곡을 곡 줄로 보여 준다.
 * 위: 뒤로 + `삼중 · {닉네임}와 비교`, 요약 3칸(승·무·패 / 점수 차 합계 / 접전 곡 수), 필터 칩(전체·열세·접전·우세와 각 곡 수),
 * 곡 줄 목록(공통 줄 + 상대 점수·`나 …`·차이 칩, 페이지네이션), 아래 안내 한 줄(차이는 내 점수 − 상대 점수).
 * 필터와 쪽은 부모(주소의 `?filter=&page=`)가 쥐고, `from`은 돌아갈 때 대시보드 탭을 되살리려고 주소에 실어 온 값이다.
 * 정렬은 서버 기본값을 쓴다(필터에 맞는 순서: 열세는 많이 진 순, 우세는 크게 이긴 순, 접전은 차이가 작은 순). 정렬 전환은 만들지 않는다.
 */
export function RivalPatternDetailView({
  viewerId,
  targetId,
  patternKey,
  filter,
  page,
  from,
  onFilterChange,
  onPageChange,
}: {
  viewerId: number;
  targetId: number;
  patternKey: RivalPatternKey;
  filter: RivalDetailFilter;
  page: number;
  from: DashTab | null;
  onFilterChange: (filter: RivalDetailFilter) => void;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations();
  const jackets = useJackets();
  const query = useQuery({
    queryKey: dashboardKeys.detail(viewerId, targetId, patternKey, filter, null, page, DETAIL_PAGE_SIZE),
    queryFn: ({ signal }) => fetchCompareSummaryDetail(targetId, patternKey, { filter, sort: null, page, size: DETAIL_PAGE_SIZE }, signal),
    retry: false,
  });

  const backHref = from && DASH_TABS.includes(from) ? `/players/${targetId}/compare?tab=${from}` : `/players/${targetId}/compare`;
  const back = (
    <Link href={backHref} aria-label={t("Rival.dashBackAria")} title={t("Rival.dashBackAria")} className={BACK_BUTTON_CLASS}>
      <BackArrow />
    </Link>
  );

  if (query.isPending) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p role="alert" className="text-sm text-fg">
          {notFound ? t("Players.notFound") : query.error instanceof ApiError ? query.error.message : t("Rival.loadFailed")}
        </p>
      </div>
    );
  }

  const { summary, filterCounts, rows } = query.data;
  const label = patternLabel(summary.pattern, t);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {back}
        <h1 className="min-w-0 truncate text-xl font-semibold text-fg">{t("Rival.detailHeading", { pattern: label, nickname: query.data.nickname })}</h1>
      </div>

      <section aria-label={t("Rival.detailSummaryAria")} className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card p-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="font-num text-sm font-bold text-fg">{t("Rival.patternWlt", { wins: summary.wins, ties: summary.ties, losses: summary.losses })}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-fg-dim">{t("Rival.detailSumDiff")}</span>
          <span className="font-num text-lg font-bold text-fg">{formatScoreDiff(summary.scoreDiffSum)?.text ?? "–"}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-fg-dim">{t("Rival.detailCloseCount")}</span>
          <span className="font-num text-lg font-bold text-fg">{summary.closeCount}</span>
        </div>
        {isSmallSample(summary) ? <p className="col-span-3 text-[11px] text-fg-dim">{t("Rival.smallSample")}</p> : null}
      </section>

      <Segment<RivalDetailFilter>
        label={t("Rival.filterAria")}
        items={DETAIL_FILTERS.map((f) => ({ value: f.value, text: t(`Rival.${FILTER_LABEL_KEY[f.count]}`, { n: filterCounts[f.count] }) }))}
        value={filter}
        onChange={onFilterChange}
      />

      {rows.content.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Rival.emptyCharts")}</p>
      ) : (
        <>
          <ul className="overflow-hidden rounded-2xl border border-line bg-card">
            {rows.content.map((row) => (
              <ChartLine
                key={row.songDifficultyId}
                className="border-t border-row-line first:border-t-0"
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
            ))}
          </ul>
          <Pager page={page} totalPages={rows.totalPages} onChange={onPageChange} />
        </>
      )}
      <p className="text-xs text-fg-dim">{t("Rival.ratingLegend")}</p>
    </div>
  );
}
