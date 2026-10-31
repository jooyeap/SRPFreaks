"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RecordDialog } from "@/components/record/RecordDialog";
import { AverageToggle } from "@/components/table/FilterChips";
import { SortSelect } from "@/components/table/SortSelect";
import { filterSummary, TableFilterPanel } from "@/components/table/TableFilterPanel";
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
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";

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
  const [filtersOpen, setFiltersOpen] = useState(false); // 모바일에서 필터 패널을 접어 둔다(서열표 본문과 같다, 2026-10-27). 데스크톱은 항상 펼침
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
      className={BACK_BUTTON_CLASS}
    >
      <BackArrow />
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
      {/* 필터는 서열표 본문과 같은 모양이다(2026-10-27): 모바일은 `필터` 한 줄(지금 걸린 조건 요약)로 접어 두고 누르면 펼친다.
          데스크톱(md 이상)은 버튼 없이 파트·추천·속성·정렬·평균 계산을 한 카드에 가로로 둔다(넘치면 줄바꿈). 예전에는 세로로 쌓여 곡 목록이 한참 아래에서 시작했다 */}
      <button
        type="button"
        aria-expanded={filtersOpen}
        aria-controls="folder-filters"
        onClick={() => setFiltersOpen((open) => !open)}
        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-2.5 text-left text-sm md:hidden"
      >
        <span className="font-semibold text-fg">{t("Songs.filter")}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-fg-dim">{filterSummary(filters, includeZero, t)}</span>
        <span aria-hidden="true" className="text-fg-dim">
          {filtersOpen ? "▴" : "▾"}
        </span>
      </button>
      <div
        id="folder-filters"
        className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-2 rounded-2xl border border-line bg-card p-4 md:flex md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-2 md:px-4 md:py-3`}
      >
        <TableFilterPanel filters={filters} onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))} />
        <SortSelect value={sort} onChange={setSort} />
        <AverageToggle includeZero={includeZero} onChange={setIncludeZero} />
      </div>
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
