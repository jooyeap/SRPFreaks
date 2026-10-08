"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChartList } from "@/components/songs/ChartList";
import { chipsOf, groupStage } from "@/components/table/TierGroupSection";
import { ApiError } from "@/lib/api";
import type { ChartFolderResponse } from "@/lib/api-types";
import { EMPTY_MARK } from "@/lib/format";
import { fetchFolderCharts, folderAverage, folderTitle, songListKeys } from "@/lib/song-list";

/**
 * 레벨 폴더 하나(0.5 단위). 제목 줄을 누르면 펼쳐지고, 처음 펼칠 때 그 폴더의 채보를 받는다(접힌 폴더는 요청하지 않는다).
 * 칩·평균·기록 수는 서버가 계산한 값 그대로다. 폴더의 모든 채보가 같은 단계 이상이면 서열표 묶음처럼 머리에 막대·배경을 준다.
 * 모바일은 접힌 상태에서 `제목 · n개 · 평균 · ▾`만 보이고, 펼치면 칩과 `기록 n/전체`가 나온다 (DESIGN-UI 9장).
 */
export function FolderSection({
  userId,
  folder,
  includeZero,
}: {
  userId: number;
  folder: ChartFolderResponse;
  includeZero: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pages = useInfiniteQuery({
    queryKey: songListKeys.folder(userId, folder.lo),
    queryFn: ({ pageParam, signal }) => fetchFolderCharts(folder.lo, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: open,
  });

  const title = folderTitle(folder);
  const reached = groupStage(folder);
  const average = folderAverage(folder, includeZero);
  const bodyId = `folder-${folder.lo.toFixed(2)}`;
  // 모바일은 펼친 폴더에서만 칩과 기록 수를 보이고, 데스크톱(md 이상)은 접혀 있어도 한 줄에 모두 보인다
  const detailClass = open ? "flex" : "hidden md:flex";

  return (
    <section aria-label={`레벨 ${title}`} className="overflow-hidden rounded-[14px] border border-line bg-card">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          data-stage={reached ?? undefined}
          className={`relative flex w-full flex-wrap items-center gap-x-3 gap-y-2 py-3 pl-4 pr-3 text-left ${reached ? "stage-tint" : ""}`}
        >
          {reached ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
          <span className="font-num text-lg font-semibold text-fg">
            {title} <span className="ml-1 text-sm font-normal text-fg-sub">{folder.total}개</span>
          </span>
          <span className={`${detailClass} flex-wrap items-center gap-1.5`}>
            {chipsOf(folder).map((chip) => (
              <span
                key={chip.key}
                data-stage={chip.stage ?? undefined}
                className={`rounded-full border border-chip-line px-2 py-0.5 text-xs ${
                  chip.count === 0 ? "text-fg-faint" : chip.stage ? "stage-text" : "text-fg-sub"
                }`}
              >
                {chip.label} <span className="font-num">{chip.count}</span>
              </span>
            ))}
          </span>
          <span className="ml-auto flex items-baseline gap-2 text-sm text-fg-sub">
            <span className={`${detailClass} text-xs text-fg-dim`}>
              기록 {folder.recorded}/{folder.total}
            </span>
            <span>
              평균{" "}
              <span className="font-num font-semibold text-fg">{average === null ? EMPTY_MARK : `${average.toFixed(2)}%`}</span>
            </span>
            <span aria-hidden="true" className="text-fg-dim">
              {open ? "▴" : "▾"}
            </span>
          </span>
        </button>
      </h2>
      <div id={bodyId} hidden={!open}>
        {!open ? null : pages.isError ? (
          <p role="alert" className="p-3 text-sm text-fg">
            {pages.error instanceof ApiError ? pages.error.message : "곡 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
          </p>
        ) : !pages.data ? (
          <p className="p-3 text-sm text-fg-sub">불러오는 중입니다.</p>
        ) : (
          <ChartList
            label={`${title} 채보`}
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
