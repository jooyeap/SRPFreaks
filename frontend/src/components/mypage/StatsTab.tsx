"use client";

import { useQuery } from "@tanstack/react-query";
import { OverallStageCard } from "@/components/mypage/OverallStageCard";
import { Pager, usePaged } from "@/components/Pager";
import { RateFolderCard } from "@/components/mypage/RateFolderCard";
import { Skeleton } from "@/components/Skeleton";
import { ApiError } from "@/lib/api";
import type { RateFolderListResponse, RateFolderResponse } from "@/lib/api-types";
import { fetchDifficultyTables, pickRatingTable, tableKeys } from "@/lib/difficulty-table";
import { overallStages } from "@/lib/my-page";
import { fetchChartFolders, songListKeys } from "@/lib/song-list";
import { fetchLevelRateFolders, fetchTierRateFolders, statsKeys, type StatsAxis } from "@/lib/rate-folders";

const AXES: readonly { value: StatsAxis; label: string }[] = [
  { value: "level", label: "레벨 폴더" },
  { value: "tier", label: "서열표 난이도" },
];

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 통계 탭: `레벨 폴더 | 서열표 난이도` 두 기준 중 하나를 골라, 폴더마다 달성률 구간별 채보 수를 보여 준다.
 * 레벨 폴더는 곡 목록의 0.5 단위 폴더와 같고(모든 채보), 서열표 난이도는 서열표에 올라 있고 난이도가 정해진 채보만 센다.
 * 두 기준은 한 번에 하나만 불러온다(고른 쪽만 요청). 집계는 서버가 한다.
 * 맨 위에 전체 달성 현황을 둔다. 곡 목록의 폴더 API(/songs/chart-folders)를 합산하고 곡 목록 화면과 같은 쿼리 키라 캐시를 함께 쓴다.
 */
export function StatsTab({ userId, axis, onAxisChange }: { userId: number; axis: StatsAxis; onAxisChange: (axis: StatsAxis) => void }) {
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
        <p role="alert" className="text-sm text-fg">달성 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : (
        <Skeleton label="달성 현황을 불러오는 중입니다." className="h-[8.5rem]" />
      )}
      <div role="tablist" aria-label="통계 기준" className="flex gap-1 border-b border-line">
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
              {a.label}
            </button>
          );
        })}
      </div>
      {axis === "level" ? <LevelFolders userId={userId} /> : <TierFolders userId={userId} />}
    </div>
  );
}

function LevelFolders({ userId }: { userId: number }) {
  const q = useQuery({
    queryKey: statsKeys.levelFolders(userId),
    queryFn: ({ signal }) => fetchLevelRateFolders(signal),
  });
  return <FolderList axis="level" query={q} emptyText="아직 등록된 곡이 없습니다." />;
}

function TierFolders({ userId }: { userId: number }) {
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
    return <p className="text-sm text-fg-sub">사용할 수 있는 서열표가 아직 없습니다.</p>;
  }
  if (tables.isError) {
    return <p role="alert" className="text-sm text-fg">{errorMessage(tables.error)}</p>;
  }
  return <FolderList axis="tier" query={q} emptyText="서열표에 레이팅 상수 난이도가 정해진 채보가 아직 없습니다." />;
}

function FolderList({
  axis,
  query,
  emptyText,
}: {
  axis: StatsAxis;
  query: { data?: RateFolderListResponse; isError: boolean; error: unknown };
  emptyText: string;
}) {
  if (query.data) {
    return query.data.folders.length === 0 ? (
      <p className="text-sm text-fg-sub">{emptyText}</p>
    ) : (
      <PagedFolders axis={axis} folders={query.data.folders} />
    );
  }
  if (query.isError) {
    return <p role="alert" className="text-sm text-fg">{errorMessage(query.error)}</p>;
  }
  return <Skeleton label="통계를 불러오는 중입니다." className="h-72" />;
}

/** 폴더가 많아서(특히 서열표 난이도) 10개씩 나눠 보여 준다. 기준을 바꾸면 컴포넌트가 새로 만들어져 1페이지로 돌아간다. */
function PagedFolders({ axis, folders }: { axis: StatsAxis; folders: readonly RateFolderResponse[] }) {
  const { page, totalPages, pageItems, setPage } = usePaged(folders);
  return (
    <>
      <div className="flex flex-col gap-2.5">
        {pageItems.map((folder) => (
          <RateFolderCard key={folder.key} axis={axis} folder={folder} />
        ))}
      </div>
      <Pager page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );
}
