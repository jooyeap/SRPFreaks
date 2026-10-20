"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChartList } from "@/components/songs/ChartList";
import { chipsOf, groupStage } from "@/components/table/TierGroupSection";
import { ApiError } from "@/lib/api";
import type { ChartFolderResponse } from "@/lib/api-types";
import { EMPTY_MARK } from "@/lib/format";
import {
  EMPTY_SONG_FILTERS,
  type FolderStep,
  fetchFolderCharts,
  folderAverage,
  folderTitle,
  type SongListFilters,
  songListKeys,
} from "@/lib/song-list";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";

/**
 * 레벨 폴더 하나. 큰 폴더(0.5 단위)를 펼치면 안에 0.05 단위 하위 폴더(같은 컴포넌트, level="sub")가 나오고,
 * 하위 폴더를 펼치면 채보가 나온다. 하위 폴더가 없는 큰 폴더(옛 응답)는 바로 채보를 보여 준다.
 * 제목 줄을 누르면 펼쳐지고, 처음 펼칠 때 채보를 받는다(접힌 폴더는 요청하지 않는다).
 * 칩·평균·기록 수는 서버가 계산한 값 그대로다. 폴더의 모든 채보가 같은 단계 이상이면 서열표 묶음처럼 머리에 막대·배경을 준다.
 * 모바일은 접힌 상태에서 `제목 · n개 · 평균 · ▾`만 보이고, 펼치면 칩과 `기록 n/전체`가 나온다 (DESIGN-UI 9장).
 */
export function FolderSection({
  userId,
  folder,
  includeZero,
  filters = EMPTY_SONG_FILTERS,
  level = "top",
}: {
  userId: number;
  folder: ChartFolderResponse;
  includeZero: boolean;
  /** 걸려 있는 검색·필터. 폴더 안 채보 목록도 같은 조건으로 받는다 */
  filters?: SongListFilters;
  /** top: 0.5 단위 큰 폴더, sub: 그 안의 0.05 단위 하위 폴더 */
  level?: "top" | "sub";
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const isSub = level === "sub";
  const subFolders = folder.subFolders ?? [];
  const step: FolderStep = isSub ? "0.05" : "0.50";
  // 채보를 직접 보여 주는 폴더: 하위 폴더 또는, 하위 폴더가 없는 큰 폴더
  const showsCharts = isSub || subFolders.length === 0;
  const pages = useInfiniteQuery({
    queryKey: songListKeys.folder(userId, folder.lo, step, filters),
    queryFn: ({ pageParam, signal }) => fetchFolderCharts(folder.lo, step, pageParam, signal, filters),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: open && showsCharts,
  });

  const title = folderTitle(folder);
  const reached = groupStage(folder);
  const average = folderAverage(folder, includeZero);
  const bodyId = `folder-${step}-${folder.lo.toFixed(2)}`;
  // 모바일은 펼친 폴더에서만 칩과 기록 수를 보이고, 데스크톱(md 이상)은 접혀 있어도 한 줄에 모두 보인다
  const HeadingTag = isSub ? "h3" : "h2";
  const detailClass = open ? "flex" : "hidden md:flex";

  return (
    <section
      aria-label={t("Songs.levelFolderAria", { title })}
      className={
        isSub ? "overflow-hidden rounded-[10px] border border-line bg-table-head" : "overflow-hidden rounded-2xl border border-line bg-card"
      }
    >
      <HeadingTag>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          data-stage={reached ?? undefined}
          className={`relative flex w-full flex-wrap items-center gap-x-3 gap-y-2 py-3 pl-4 pr-3 text-left ${reached ? "stage-tint" : ""}`}
        >
          {reached ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
          <span className={`font-num font-semibold text-fg ${isSub ? "text-base" : "text-lg"}`}>
            {title} <span className="ml-1 text-sm font-normal text-fg-sub">{t("Songs.chartCount", { count: folder.total })}</span>
          </span>
          <span className={`${detailClass} flex-wrap items-center gap-1.5`}>
            {chipsOf(folder).map((chip) => (
              <span
                key={chip.key}
                data-stage={chip.stage ?? undefined}
                className={`rounded-lg border border-chip-line px-2 py-0.5 text-xs ${
                  chip.count === 0 ? "text-fg-faint" : chip.stage ? "stage-text" : "text-fg-sub"
                }`}
              >
                {chip.stage ? chip.label : t("Progress.belowS")} <span className="font-num">{chip.count}</span>
              </span>
            ))}
          </span>
          <span className="ml-auto flex items-baseline gap-2 text-sm text-fg-sub">
            <span className={`${detailClass} text-xs text-fg-dim`}>
              {t("Songs.recordedOf", { recorded: folder.recorded, total: folder.total })}
            </span>
            <span>
              {t("Songs.average")}{" "}
              <span className="font-num font-semibold text-fg">{average === null ? EMPTY_MARK : `${average.toFixed(2)}%`}</span>
            </span>
            <span aria-hidden="true" className="text-fg-dim">
              {open ? "▴" : "▾"}
            </span>
          </span>
        </button>
      </HeadingTag>
      <div id={bodyId} hidden={!open}>
        {!open ? null : !showsCharts ? (
          <div className="flex flex-col gap-2 p-2">
            {subFolders.map((sub) => (
              <FolderSection key={sub.lo} userId={userId} folder={sub} includeZero={includeZero} filters={filters} level="sub" />
            ))}
          </div>
        ) : pages.isError ? (
          <ErrorRetry className="p-3" onRetry={() => void pages.refetch()} retrying={pages.isFetching}>
            {pages.error instanceof ApiError ? pages.error.message : t("Songs.loadFailed")}
          </ErrorRetry>
        ) : !pages.data ? (
          <p className="p-3 text-sm text-fg-sub">{t("Common.loading")}</p>
        ) : (
          <ChartList
            label={t("Songs.chartsAria", { title })}
            rows={pages.data.pages.flatMap((p) => p.content)}
            hasMore={pages.hasNextPage}
            loadingMore={pages.isFetchingNextPage}
            onMore={() => void pages.fetchNextPage()}
          />
        )}
      </div>
    </section>
  );
}
