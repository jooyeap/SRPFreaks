"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { RecordDialog } from "@/components/record/RecordDialog";
import { Chip } from "@/components/table/FilterChips";
import { SortSelect } from "@/components/table/SortSelect";
import { TierGroupSection } from "@/components/table/TierGroupSection";
import { ApiError } from "@/lib/api";
import {
  allGroupsKey,
  fetchAllTierGroups,
  fetchDifficultyTables,
  findGroupByParam,
  pickRatingTable,
  tableKeys,
} from "@/lib/difficulty-table";
import { DEFAULT_SORT, type TableSort } from "@/lib/table-sort";
import type { TableEntryResponse } from "@/lib/api-types";

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "묶음을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 서열표 묶음 하나(기준 난이도 하나)를 따로 보는 화면. `/table/folder/5.8`.
 * 곡 상세의 "같은 난이도의 곡 → 묶음 전체 보기"에서 들어온다.
 * 곡 상세와 같은 쿼리 키(allGroupsKey)를 써서, 곡 상세에서 이미 받은 서열표를 다시 받지 않고 재사용한다.
 * 서열표에서 묶음 하나만 달라는 서버 API는 따로 없어서(묶음 단위 페이지만 있다) 전체를 받아 해당 묶음만 고른다.
 */
export function TierFolderView({ userId, param }: { userId: number; param: string }) {
  const [includeZero, setIncludeZero] = useState(false);
  const [sort, setSort] = useState<TableSort>(DEFAULT_SORT);
  const [recordTarget, setRecordTarget] = useState<{ entry: TableEntryResponse; tier: number | null } | null>(null);

  const tables = useQuery({
    queryKey: tableKeys.list,
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    select: pickRatingTable,
  });
  const tableId = tables.data?.id ?? null;
  const groups = useQuery({
    queryKey: allGroupsKey(userId, tableId ?? 0),
    queryFn: ({ signal }) => fetchAllTierGroups(tableId ?? 0, signal),
    enabled: tableId !== null,
  });

  const back = (
    <Link
      href="/table"
      aria-label="서열표로"
      title="서열표로"
      className="self-start rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
    >
      <span aria-hidden="true">←</span>
    </Link>
  );

  if (tables.isPending || (tableId !== null && groups.isPending)) {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (tables.isError || groups.isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p role="alert" className="text-sm text-fg">{errorMessage(tables.error ?? groups.error)}</p>
      </div>
    );
  }
  const group = groups.data ? findGroupByParam(groups.data, param) : null;
  if (!group) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p role="alert" className="text-sm text-fg">묶음을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {back}
      <div role="group" aria-label="평균 계산" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-fg-dim">평균 계산</span>
        <Chip pressed={!includeZero} onClick={() => setIncludeZero(false)}>
          0% 미포함
        </Chip>
        <Chip pressed={includeZero} onClick={() => setIncludeZero(true)}>
          0% 포함
        </Chip>
      </div>
      <SortSelect value={sort} onChange={setSort} />
      <TierGroupSection group={group} includeZero={includeZero} sort={sort} onRecord={(entry, tier) => setRecordTarget({ entry, tier })} />
      <RecordDialog
        chart={
          recordTarget && {
            songDifficultyId: recordTarget.entry.songDifficultyId,
            title: recordTarget.entry.title,
            part: recordTarget.entry.part,
            difficulty: recordTarget.entry.difficulty,
            level: recordTarget.entry.level,
            tier: recordTarget.tier,
          }
        }
        onClose={() => setRecordTarget(null)}
      />
    </div>
  );
}
