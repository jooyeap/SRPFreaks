"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { OverallStageCard } from "@/components/mypage/OverallStageCard";
import { Pager, usePaged } from "@/components/Pager";
import { RateFolderMaster } from "@/components/mypage/RateFolderMaster";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { RateFolderCard } from "@/components/mypage/RateFolderCard";
import { AverageToggle } from "@/components/table/FilterChips";
import { Skeleton } from "@/components/Skeleton";
import { ApiError } from "@/lib/api";
import type { RateFolderListResponse, RateFolderResponse } from "@/lib/api-types";
import { fetchDifficultyTables, pickRatingTable, tableKeys } from "@/lib/difficulty-table";
import { overallStages } from "@/lib/my-page";
import { fetchChartFolders, songListKeys } from "@/lib/song-list";
import { fetchLevelRateFolders, fetchTierRateFolders, statsKeys, type StatsAxis } from "@/lib/rate-folders";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";
import type { MessageKey } from "@/i18n/translator";

const AXES: readonly { value: StatsAxis; labelKey: MessageKey }[] = [
  { value: "level", labelKey: "MyPage.axisLevel" },
  { value: "tier", labelKey: "MyPage.axisTier" },
];

function errorMessage(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("MyPage.statsFailed");
}

/**
 * 통계 탭: `레벨 폴더 | 서열표 난이도` 두 기준 중 하나를 골라, 폴더마다 달성률 구간별 채보 수를 보여 준다.
 * 레벨 폴더는 곡 목록의 0.5 단위 폴더와 같고(모든 채보), 서열표 난이도는 서열표에 올라 있고 난이도가 정해진 채보만 센다.
 * 두 기준은 한 번에 하나만 불러온다(고른 쪽만 요청). 집계는 서버가 한다.
 * 맨 위에 전체 달성 현황을 둔다. 곡 목록의 폴더 API(/songs/chart-folders)를 합산하고 곡 목록 화면과 같은 쿼리 키라 캐시를 함께 쓴다.
 */
export function StatsTab({ userId, axis, onAxisChange }: { userId: number; axis: StatsAxis; onAxisChange: (axis: StatsAxis) => void }) {
  const t = useTranslations();
  const [includeZero, setIncludeZero] = useState(false); // 0% 미포함이 기본 (DESIGN-UI 3장)
  const overall = useQuery({
    queryKey: songListKeys.folders(userId),
    queryFn: ({ signal }) => fetchChartFolders(signal),
    select: overallStages,
  });
  return (
    <div className="flex flex-col gap-4">
      {overall.data ? (
        <OverallStageCard stages={overall.data} />
      ) : overall.isError ? (
        <ErrorRetry onRetry={() => void overall.refetch()} retrying={overall.isFetching}>
          {t("MyPage.overallFailed")}
        </ErrorRetry>
      ) : (
        <Skeleton label={t("MyPage.overallLoading")} className="h-[8.5rem]" />
      )}
      <div role="tablist" aria-label={t("MyPage.axesAria")} className="flex gap-1 border-b border-line">
        {AXES.map((a) => {
          const selected = a.value === axis;
          return (
            <button
              key={a.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onAxisChange(a.value)}
              // 선택은 굵은 글씨와 아래 줄로도 보인다(색만으로 구분하지 않는다)
              className={`-mb-px min-h-11 border-b-2 px-4 text-sm ${
                selected ? "border-fg font-bold text-fg" : "border-transparent text-fg-sub hover:text-fg"
              }`}
            >
              {t(a.labelKey)}
            </button>
          );
        })}
      </div>
      <AverageToggle includeZero={includeZero} onChange={setIncludeZero} />
      {axis === "level" ? <LevelFolders userId={userId} includeZero={includeZero} /> : <TierFolders userId={userId} includeZero={includeZero} />}
    </div>
  );
}

function LevelFolders({ userId, includeZero }: { userId: number; includeZero: boolean }) {
  const t = useTranslations();
  const q = useQuery({
    queryKey: statsKeys.levelFolders(userId),
    queryFn: ({ signal }) => fetchLevelRateFolders(signal),
  });
  return <FolderList axis="level" query={q} includeZero={includeZero} emptyText={t("MyPage.noSongsYet")} />;
}

function TierFolders({ userId, includeZero }: { userId: number; includeZero: boolean }) {
  const t = useTranslations();
  const tables = useQuery({
    queryKey: tableKeys.list,
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    select: pickRatingTable,
  });
  const tableId = tables.data?.id ?? null;
  const q = useQuery({
    queryKey: statsKeys.tierFolders(userId, tableId ?? 0),
    queryFn: ({ signal }) => fetchTierRateFolders(tableId ?? 0, signal),
    enabled: tableId !== null,
  });
  if (tables.isSuccess && tableId === null) {
    return <p className="text-sm text-fg-sub">{t("MyPage.noTables")}</p>;
  }
  if (tables.isError) {
    return (
      <ErrorRetry onRetry={() => void tables.refetch()} retrying={tables.isFetching}>
        {errorMessage(tables.error, t)}
      </ErrorRetry>
    );
  }
  return <FolderList axis="tier" query={q} includeZero={includeZero} emptyText={t("MyPage.noRatedCharts")} />;
}

function FolderList({
  axis,
  query,
  includeZero,
  emptyText,
}: {
  axis: StatsAxis;
  includeZero: boolean;
  query: { data?: RateFolderListResponse; isError: boolean; error: unknown; refetch: () => unknown; isFetching: boolean };
  emptyText: string;
}) {
  const t = useTranslations();
  if (query.data) {
    return query.data.folders.length === 0 ? (
      <p className="text-sm text-fg-sub">{emptyText}</p>
    ) : (
      <PagedFolders key={axis} axis={axis} folders={query.data.folders} includeZero={includeZero} />
    );
  }
  if (query.isError) {
    return (
      <ErrorRetry onRetry={() => void query.refetch()} retrying={query.isFetching}>
        {errorMessage(query.error, t)}
      </ErrorRetry>
    );
  }
  return <Skeleton label={t("MyPage.statsLoading")} className="h-72" />;
}

/** 폴더가 많아서(특히 서열표 난이도) 10개씩 나눠 보여 준다. */
function PagedFolders({ axis, folders, includeZero }: { axis: StatsAxis; folders: readonly RateFolderResponse[]; includeZero: boolean }) {
  // 데스크톱은 좌우 분할(좌: 폴더 목록, 우: 상세), 모바일은 접이식 카드
  const desktop = useMediaQuery(DESKTOP_QUERY);
  if (desktop) return <RateFolderMaster axis={axis} folders={folders} includeZero={includeZero} />;
  return <MobileFolders axis={axis} folders={folders} includeZero={includeZero} />;
}

function MobileFolders({ axis, folders, includeZero }: { axis: StatsAxis; folders: readonly RateFolderResponse[]; includeZero: boolean }) {
  const { page, totalPages, pageItems, setPage } = usePaged(folders);
  return (
    <>
      <div className="flex flex-col gap-2.5">
        {pageItems.map((folder) => (
          <RateFolderCard key={folder.key} axis={axis} folder={folder} includeZero={includeZero} />
        ))}
      </div>
      <Pager page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );
}
