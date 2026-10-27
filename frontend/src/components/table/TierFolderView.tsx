"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RecordDialog } from "@/components/record/RecordDialog";
import { AverageToggle } from "@/components/table/FilterChips";
import { SortSelect } from "@/components/table/SortSelect";
import { TableFilterPanel } from "@/components/table/TableFilterPanel";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { TableSearch } from "@/components/table/TableSearch";
import { TierFolderNav } from "@/components/table/TierFolderNav";
import { TierGroupSection } from "@/components/table/TierGroupSection";
import { FolderThresholdNote } from "@/components/table/FolderThresholdNote";
import { ApiError } from "@/lib/api";
import {
  allGroupsKey,
  decidedGroups,
  EMPTY_FILTERS,
  fetchAllTierGroups,
  fetchDifficultyTables,
  filterTierGroup,
  findGroupByParam,
  hasFilters,
  pickRatingTable,
  tableKeys,
  type TableFilters,
} from "@/lib/difficulty-table";
import { DEFAULT_SORT, type TableSort } from "@/lib/table-sort";
import type { TableEntryResponse } from "@/lib/api-types";
import { ErrorRetry } from "@/components/ErrorRetry";
import { isLoggedInViewer } from "@/lib/viewer";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

function errorMessage(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("Table.groupLoadFailed");
}

/**
 * 서열표 묶음 하나(기준 난이도 하나)를 따로 보는 화면. `/table/folder/5.8`.
 * 곡 상세의 "같은 난이도의 곡 → 묶음 전체 보기"에서 들어온다.
 * 곡 상세와 같은 쿼리 키(allGroupsKey)를 써서, 곡 상세에서 이미 받은 서열표를 다시 받지 않고 재사용한다.
 * 서열표에서 묶음 하나만 달라는 서버 API는 따로 없어서(묶음 단위 페이지만 있다) 전체를 받아 해당 묶음만 고른다.
 * 파트·추천·속성 필터도 같은 이유로 화면에서 건다(filterTierGroup). 서열표 본문과 달리 처음에는 필터가 없고(묶음 전체), 머리의 개수·평균은 걸러진 채보 기준이다.
 */
export function TierFolderView({ userId, param }: { userId: number; param: string }) {
  const t = useTranslations();
  const [includeZero, setIncludeZero] = useState(false);
  const [sort, setSort] = useState<TableSort>(DEFAULT_SORT);
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS);
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
    select: decidedGroups, // 미정 묶음은 서열표 화면에서 뺀다(곡 상세·홈과 캐시는 같이 쓰고 여기서만 거른다)
  });

  const rawGroup = useMemo(() => (groups.data ? findGroupByParam(groups.data, param) : null), [groups.data, param]);
  const group = useMemo(() => (rawGroup ? filterTierGroup(rawGroup, filters) : null), [rawGroup, filters]);

  const back = (
    <Link
      href="/table"
      aria-label={t("Table.toTable")}
      title={t("Table.toTable")}
      className="self-start min-h-11 rounded-lg border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
    >
      <span aria-hidden="true">←</span>
    </Link>
  );

  if (tables.isPending || (tableId !== null && groups.isPending)) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (tables.isError || groups.isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorRetry
          onRetry={() => void (tables.isError ? tables.refetch() : groups.refetch())}
          retrying={tables.isFetching || groups.isFetching}
        >
          {errorMessage(tables.error ?? groups.error, t)}
        </ErrorRetry>
      </div>
    );
  }
  if (!group || !rawGroup) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p role="alert" className="text-sm text-fg">{t("Table.groupNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {back}
      {groups.data ? <TierFolderNav groups={groups.data} currentTier={rawGroup.tier} /> : null}
      {/* 이 구간을 몇 % 이상 치면 내 레이팅에 반영되는지(로그인했을 때만, 홈 진행도 카드 안내와 같은 계산) */}
      {isLoggedInViewer(userId) && rawGroup.tier !== null ? <FolderThresholdNote userId={userId} tier={rawGroup.tier} entries={rawGroup.entries} /> : null}
      {/* 곡 검색: 화면 위쪽 검색창 + 결과(누르면 곡 상세로). 좌측 하단 고정 버튼은 이 검색창으로 포커스를 옮긴다 */}
      <TableSearch userId={userId} groups={groups.data} />
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <TableFilterPanel filters={filters} onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))} />
      </div>
      <AverageToggle includeZero={includeZero} onChange={setIncludeZero} />
      <SortSelect value={sort} onChange={setSort} />
      {hasFilters(filters) && group.entries.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Songs.noMatch")}</p>
      ) : null}
      <TierGroupSection group={group} includeZero={includeZero} sort={sort} onRecord={isLoggedInViewer(userId) ? (entry, tier) => setRecordTarget({ entry, tier }) : undefined} />
      <ScrollTopButton />
      <RecordDialog
        chart={
          recordTarget && {
            songDifficultyId: recordTarget.entry.songDifficultyId,
            title: recordTarget.entry.title,
            part: recordTarget.entry.part,
            difficulty: recordTarget.entry.difficulty,
            level: recordTarget.entry.level,
            tier: recordTarget.tier,
            pattern: recordTarget.entry.pattern,
            ratingEnabled: recordTarget.entry.ratingEnabled,
          }
        }
        onClose={() => setRecordTarget(null)}
      />
    </div>
  );
}
