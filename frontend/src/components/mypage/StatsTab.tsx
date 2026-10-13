"use client";

import { useQuery } from "@tanstack/react-query";
import { RateFolderCard } from "@/components/mypage/RateFolderCard";
import { Skeleton } from "@/components/Skeleton";
import { ApiError } from "@/lib/api";
import type { RateFolderListResponse } from "@/lib/api-types";
import { fetchDifficultyTables, pickRatingTable, tableKeys } from "@/lib/difficulty-table";
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
 */
export function StatsTab({ userId, axis, onAxisChange }: { userId: number; axis: StatsAxis; onAxisChange: (axis: StatsAxis) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="통계 기준" className="flex gap-1.5">
        {AXES.map((a) => {
          const selected = a.value === axis;
          return (
            <button
              key={a.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onAxisChange(a.value)}
              className={`min-h-9 rounded-full border px-3.5 text-sm ${
                selected ? "border-chip-on-bg bg-chip-on-bg font-bold text-chip-on-fg" : "border-chip-line text-fg-sub hover:text-fg"
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
      <div className="flex flex-col gap-2.5">
        {query.data.folders.map((folder) => (
          <RateFolderCard key={folder.key} axis={axis} folder={folder} />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return <p role="alert" className="text-sm text-fg">{errorMessage(query.error)}</p>;
  }
  return <Skeleton label="통계를 불러오는 중입니다." className="h-72" />;
}
