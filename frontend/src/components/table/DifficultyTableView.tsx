"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { TableCredit } from "@/components/TableCredit";
import { RecordDialog } from "@/components/record/RecordDialog";
import { SongCreateButton } from "@/components/songs/SongCreateButton";
import { AverageToggle } from "@/components/table/FilterChips";
import { SortSelect } from "@/components/table/SortSelect";
import { PART_OPTIONS, TableFilterPanel } from "@/components/table/TableFilterPanel";
import { TableSearch } from "@/components/table/TableSearch";
import { TierGroupSection } from "@/components/table/TierGroupSection";
import { TierQuickNav } from "@/components/table/TierQuickNav";
import { ApiError } from "@/lib/api";
import {
  allGroupsKey,
  decidedGroups,
  fetchAllTierGroups,
  fetchDifficultyTables,
  fetchTableEntries,
  pickRatingTable,
  tableKeys,
  type TableFilters,
} from "@/lib/difficulty-table";
import type { TableEntryResponse } from "@/lib/api-types";
import { DEFAULT_VIEW_STATE, type TableViewState } from "@/lib/table-view-state";
import type { TableSort } from "@/lib/table-sort";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";

/** 접힌 필터 줄에 보여 줄 요약. 걸린 필터가 없으면 "전체". */
function filterSummary(filters: TableFilters, includeZero: boolean): string {
  const picked = [
    filters.part ? PART_OPTIONS.find((o) => o.value === filters.part)?.label : null,
    filters.recommend.length > 0 ? `추천 ${filters.recommend.join("·")}` : null,
    filters.pattern.length > 0 ? `속성 ${filters.pattern.join("·")}` : null,
  ].filter((v): v is string => Boolean(v));
  const average = includeZero ? "평균 0% 포함" : "평균 0% 미포함";
  return `${picked.length > 0 ? picked.join(" · ") : "전체"} · ${average}`;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "서열표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 서열표 본문. 로그인한 사용자만 이 컴포넌트를 그린다(서버 API가 로그인을 요구하고, 내 기록을 함께 보여 주기 때문).
 * userId를 쿼리 키에 넣는 이유: 로그아웃 후 다른 계정으로 로그인했을 때 이전 사용자의 기록 캐시가 보이지 않게 하려는 것이다.
 */
export function DifficultyTableView({
  userId,
  canRegister = false,
  state: controlledState,
  onStateChange,
}: {
  userId: number;
  canRegister?: boolean;
  /**
   * 필터·정렬·평균 계산·페이지(보기 상태). 서열표 페이지가 주소 쿼리에서 읽어 넘기면 곡 상세에 갔다 뒤로 와도 그대로 남는다.
   * 넘기지 않으면 이 컴포넌트가 스스로 갖는다(처음에는 기본 상태).
   */
  state?: TableViewState;
  onStateChange?: (next: TableViewState) => void;
}) {
  const [innerState, setInnerState] = useState<TableViewState>(DEFAULT_VIEW_STATE);
  const view = controlledState ?? innerState;
  const updateView = useCallback(
    (patch: Partial<TableViewState>) => {
      const next = { ...view, ...patch };
      if (onStateChange) onStateChange(next);
      else setInnerState(next);
    },
    [view, onStateChange],
  );
  const { filters, page, sort, includeZero } = view;
  const setPage = (next: number | ((p: number) => number)) => updateView({ page: typeof next === "function" ? next(page) : next });
  const setSort = (next: TableSort) => updateView({ sort: next }); // 묶음 안 채보 정렬. 서버 요청과 무관해서 페이지·캐시에 영향이 없다
  const setIncludeZero = (next: boolean) => updateView({ includeZero: next }); // 0% 미포함이 기본 (DESIGN-UI 3장)
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다
  const [filtersOpen, setFiltersOpen] = useState(false); // 모바일에서 필터 패널을 접어 둔다 (데스크톱은 항상 펼침)
  // 펼친 묶음의 난이도(미정은 "undecided"). 처음에는 모두 닫혀 있다. 페이지·필터를 바꿔도 같은 난이도는 그대로 펼쳐 있다
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const [recordTarget, setRecordTarget] = useState<{ entry: TableEntryResponse; tier: number | null } | null>(null); // 기록 입력창을 연 채보

  const tables = useQuery({
    queryKey: tableKeys.list,
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    select: pickRatingTable,
  });
  const table = tables.data ?? null;

  const entries = useQuery({
    queryKey: tableKeys.entries(userId, table?.id ?? 0, filters, page),
    queryFn: ({ signal }) => fetchTableEntries(table?.id ?? 0, filters, page, signal),
    enabled: table !== null,
    placeholderData: keepPreviousData, // 페이지/필터를 바꾸는 동안 이전 화면을 유지한다 (깜빡임 방지)
  });

  // 난이도 바로가기용 전체 묶음. 홈·곡 상세·묶음 페이지와 같은 키라 캐시를 함께 쓴다. 실패해도 서열표 본문은 그대로 보여 준다
  const allGroups = useQuery({
    queryKey: allGroupsKey(userId, table?.id ?? 0),
    queryFn: ({ signal }) => fetchAllTierGroups(table?.id ?? 0, signal),
    enabled: table !== null,
  });

  // 필터를 바꾸면 첫 페이지부터 다시 본다 (이전 필터의 3페이지가 새 결과에는 없을 수 있다)
  function changeFilter(next: Partial<TableFilters>) {
    updateView({ filters: { ...filters, ...next }, page: 0 });
  }

  if (tables.isPending) {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (tables.isError) {
    return <p role="alert" className="text-sm text-fg">{errorMessage(tables.error)}</p>;
  }
  if (!table) {
    return <p className="text-sm text-fg-sub">SRN+ 서열표가 아직 없습니다.</p>;
  }

  const data = entries.data;
  const groupKeys = (data?.content ?? []).map((g) => String(g.tier ?? "undecided"));
  const allOpen = groupKeys.length > 0 && groupKeys.every((k) => openGroups.has(k));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">{table.name}</h1>
          <p className="mt-1 text-sm text-fg-sub">속성은 SRN+ 옵션 사용 기준</p>
          <TableCredit className="mt-1 text-xs text-fg-dim" />
        </div>
        {/* ROOT·ADMIN만: 곡과 채보를 등록하면서 이 서열표에도 추가한다 */}
        {canRegister ? <SongCreateButton tableId={table.id} /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {allGroups.data ? <TierQuickNav groups={decidedGroups(allGroups.data)} /> : null}
        {/* 지금 페이지의 묶음을 한꺼번에 펼치거나 접는다(묶음이 처음에 모두 닫혀 있어서 하나씩 열기 번거롭다) */}
        {data && data.content.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpenGroups(allOpen ? new Set() : new Set(groupKeys))}
            className="rounded-lg border border-chip-line bg-card px-4 py-1.5 text-sm text-fg hover:bg-table-head"
          >
            {allOpen ? "모두 접기" : "모두 펼치기"}
          </button>
        ) : null}
      </div>

      {/* 모바일: 접힌 상태에서도 지금 걸린 필터를 한 줄로 보여 준다. 데스크톱(md 이상)은 버튼 없이 항상 펼친다 */}
      <button
        type="button"
        aria-expanded={filtersOpen}
        aria-controls="table-filters"
        onClick={() => setFiltersOpen((open) => !open)}
        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-left text-sm md:hidden"
      >
        <span className="font-semibold text-fg">필터</span>
        <span className="min-w-0 flex-1 truncate text-xs text-fg-dim">{filterSummary(filters, includeZero)}</span>
        <span aria-hidden="true" className="text-fg-dim">
          {filtersOpen ? "▴" : "▾"}
        </span>
      </button>
      <div
        id="table-filters"
        // 모바일: 세로로 쌓이는 접이식 패널. 데스크톱(md 이상): 파트 · 추천 · 속성 · 정렬 · 평균 계산이 한 카드 안에 가로로 놓인다(시안, 넘치면 줄바꿈)
        className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-2 rounded-xl border border-line bg-card p-3 md:flex md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-2 md:rounded-2xl md:px-4 md:py-3`}
      >
        <TableFilterPanel filters={filters} onChange={changeFilter} />
        <SortSelect value={sort} onChange={setSort} />
        <AverageToggle includeZero={includeZero} onChange={setIncludeZero} />
      </div>

      {entries.isError ? (
        <p role="alert" className="text-sm text-fg">{errorMessage(entries.error)}</p>
      ) : !data ? (
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">조건에 맞는 채보가 없습니다.</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {data.content.map((group) => (
              <TierGroupSection
                key={group.tier ?? "undecided"}
                group={group}
                includeZero={includeZero}
                sort={sort}
                collapsible
                open={openGroups.has(String(group.tier ?? "undecided"))}
                onOpenChange={(next) =>
                  setOpenGroups((current) => {
                    const copy = new Set(current);
                    if (next) copy.add(String(group.tier ?? "undecided"));
                    else copy.delete(String(group.tier ?? "undecided"));
                    return copy;
                  })
                }
                onRecord={(entry, tier) => setRecordTarget({ entry, tier })}
              />
            ))}
          </div>
          <nav aria-label="페이지 이동" className="flex items-center justify-center gap-3 text-sm text-fg-sub">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              className="rounded-lg border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              이전
            </button>
            <span className="font-num">
              {data.page + 1} / {Math.max(data.totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={page + 1 >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              다음
            </button>
          </nav>
        </>
      )}
      <ScrollTopButton lifted />
      <TableSearch userId={userId} groups={allGroups.data && decidedGroups(allGroups.data)} />
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
