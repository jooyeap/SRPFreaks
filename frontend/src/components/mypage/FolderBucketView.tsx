"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChartList } from "@/components/songs/ChartList";
import { FilterChips } from "@/components/table/FilterChips";
import { Skeleton } from "@/components/Skeleton";
import { tableDetailHref } from "@/components/song/TableContext";
import { ApiError } from "@/lib/api";
import { fetchDifficultyTables, pickRatingTable, tableKeys } from "@/lib/difficulty-table";
import { myPageStateToQuery } from "@/lib/my-page";
import {
  bucketLabel,
  FOLDER_SORT_OPTIONS,
  folderChartsKeys,
  folderLabel,
  fetchFolderBucketCharts,
  type FolderChartSort,
  type FolderViewState,
} from "@/lib/rate-folders";
import { songListDetailHref } from "@/lib/song-list";
import type { InstrumentPart } from "@/lib/types";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";

const PART_OPTIONS: readonly { value: InstrumentPart; label: string }[] = [
  { value: "GUITAR", label: "Guitar" },
  { value: "BASS", label: "Bass" },
];

function errorMessage(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("MyPage.listFailed");
}

/**
 * 마이페이지 통계에서 구간을 눌렀을 때 보는 화면: 한 폴더의 한 달성률 구간에 속한 채보 목록.
 * 레벨 폴더는 곡 목록 API(/songs/charts)에, 서열표 난이도는 통계 API에 구간·정렬을 넘겨 서버가 거른다(20개씩 `더 보기`).
 * 파트와 정렬은 이 화면의 필터이고, 모두 주소 쿼리에 있다. 곡을 누르면 그 기준의 곡 상세로 간다(서열표 난이도면 서열표 상세).
 */
export function FolderBucketView({
  userId,
  state,
  onStateChange,
}: {
  userId: number;
  state: FolderViewState;
  onStateChange: (state: FolderViewState) => void;
}) {
  const t = useTranslations();
  // 서열표 난이도 기준일 때만 서열표 id가 필요하다
  const tables = useQuery({
    queryKey: tableKeys.list,
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    select: pickRatingTable,
    enabled: state.axis === "tier",
  });
  const tableId = tables.data?.id ?? null;
  const ready = state.axis === "level" || tableId !== null;

  const pages = useInfiniteQuery({
    queryKey: folderChartsKeys.list(userId, tableId, state),
    queryFn: ({ pageParam, signal }) => fetchFolderBucketCharts(state, tableId, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: ready,
  });

  const rows = pages.data?.pages.flatMap((p) => p.content) ?? [];
  const total = pages.data?.pages[0]?.totalElements ?? 0;
  const backHref = `/me?${myPageStateToQuery({ tab: "stats", axis: state.axis })}`;
  const title = folderLabel(state.axis, state.key, t);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href={backHref} aria-label={t("MyPage.backToStats")} title={t("MyPage.backToStats")} className={BACK_BUTTON_CLASS}>
          <BackArrow />
        </Link>
        <div>
          <h1 className="font-num text-lg font-semibold text-fg">{title}</h1>
          <p className="text-sm text-fg-sub">
            {t("MyPage.axisHeader", { axis: state.axis })} · {bucketLabel(state.bucket, t)}
            {pages.data ? <span className="ml-2 font-num text-fg">{t("Songs.chartCount", { count: total })}</span> : null}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <FilterChips
          label={t("Songs.part")}
          options={PART_OPTIONS}
          selected={state.part}
          onChange={(part) => onStateChange({ ...state, part })}
        />
        <label className="flex flex-wrap items-center gap-1.5 text-xs text-fg-dim">
          <span className="mr-1">{t("MyPage.sortLabel")}</span>
          <select
            value={state.sort}
            onChange={(e) => onStateChange({ ...state, sort: e.target.value as FolderChartSort })}
            className="rounded-lg border border-chip-line bg-card px-3 py-1 text-sm text-fg"
          >
            {FOLDER_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tables.isSuccess && tableId === null ? (
        <p className="text-sm text-fg-sub">{t("MyPage.noTables")}</p>
      ) : pages.isError || tables.isError ? (
        <ErrorRetry
          onRetry={() => void (tables.isError ? tables.refetch() : pages.refetch())}
          retrying={pages.isFetching || tables.isFetching}
        >
          {errorMessage(pages.error ?? tables.error, t)}
        </ErrorRetry>
      ) : !pages.data ? (
        <Skeleton label={t("MyPage.listLoading")} className="h-72" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("MyPage.noMatch")}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <ChartList
            label={t("MyPage.bucketChartsLabel", { title, bucket: bucketLabel(state.bucket, t) })}
            rows={rows}
            hasMore={pages.hasNextPage}
            loadingMore={pages.isFetchingNextPage}
            onMore={() => void pages.fetchNextPage()}
            hrefOf={state.axis === "tier" ? tableDetailHref : songListDetailHref}
          />
        </div>
      )}
    </div>
  );
}
