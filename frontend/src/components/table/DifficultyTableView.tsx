"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TableCredit } from "@/components/TableCredit";
import { RecordDialog } from "@/components/record/RecordDialog";
import { SongCreateButton } from "@/components/songs/SongCreateButton";
import { Chip, FilterChips, MultiFilterChips, type ChipOption } from "@/components/table/FilterChips";
import { SortSelect } from "@/components/table/SortSelect";
import { TableSearch } from "@/components/table/TableSearch";
import { TierGroupSection } from "@/components/table/TierGroupSection";
import { TierQuickNav } from "@/components/table/TierQuickNav";
import { ApiError } from "@/lib/api";
import {
  allGroupsKey,
  DEFAULT_FILTERS,
  fetchAllTierGroups,
  fetchDifficultyTables,
  fetchTableEntries,
  PATTERN_OPTIONS,
  pickRatingTable,
  RECOMMEND_OPTIONS,
  tableKeys,
  toggleValue,
  type TableFilters,
} from "@/lib/difficulty-table";
import type { TableEntryResponse } from "@/lib/api-types";
import { DEFAULT_SORT, type TableSort } from "@/lib/table-sort";
import type { InstrumentPart } from "@/lib/types";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";

const PART_OPTIONS: readonly ChipOption<InstrumentPart>[] = [
  { value: "GUITAR", label: "Guitar" },
  { value: "BASS", label: "Bass" },
];
const RECOMMEND_CHIPS: readonly ChipOption<string>[] = RECOMMEND_OPTIONS.map((v) => ({ value: v, label: v }));
const PATTERN_CHIPS: readonly ChipOption<string>[] = PATTERN_OPTIONS.map((v) => ({ value: v, label: v }));

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
export function DifficultyTableView({ userId, canRegister = false }: { userId: number; canRegister?: boolean }) {
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다
  const [sort, setSort] = useState<TableSort>(DEFAULT_SORT); // 묶음 안 채보 정렬. 서버 요청과 무관해서 페이지·캐시에 영향이 없다
  const [includeZero, setIncludeZero] = useState(false); // 0% 미포함이 기본 (DESIGN-UI 3장)
  const [filtersOpen, setFiltersOpen] = useState(false); // 모바일에서 필터 패널을 접어 둔다 (데스크톱은 항상 펼침)
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
    setFilters((current) => ({ ...current, ...next }));
    setPage(0);
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

      {allGroups.data ? <TierQuickNav groups={allGroups.data} /> : null}

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
        className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-2 rounded-xl border border-line bg-card p-3 md:flex`}
      >
        <FilterChips label="파트" options={PART_OPTIONS} selected={filters.part} onChange={(part) => changeFilter({ part })} />
        <MultiFilterChips
          label="추천"
          options={RECOMMEND_CHIPS}
          selected={filters.recommend}
          onToggle={(value) => changeFilter({ recommend: toggleValue(filters.recommend, value, RECOMMEND_OPTIONS) })}
          onClear={() => changeFilter({ recommend: [] })}
        />
        <MultiFilterChips
          label="속성"
          options={PATTERN_CHIPS}
          selected={filters.pattern}
          onToggle={(value) => changeFilter({ pattern: toggleValue(filters.pattern, value, PATTERN_OPTIONS) })}
          onClear={() => changeFilter({ pattern: [] })}
        />
        <SortSelect value={sort} onChange={setSort} />
        <div role="group" aria-label="평균 계산" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-fg-dim">평균 계산</span>
          <Chip pressed={!includeZero} onClick={() => setIncludeZero(false)}>
            0% 미포함
          </Chip>
          <Chip pressed={includeZero} onClick={() => setIncludeZero(true)}>
            0% 포함
          </Chip>
        </div>
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
              <TierGroupSection key={group.tier ?? "undecided"} group={group} includeZero={includeZero} sort={sort} onRecord={(entry, tier) => setRecordTarget({ entry, tier })} />
            ))}
          </div>
          <nav aria-label="페이지 이동" className="flex items-center justify-center gap-3 text-sm text-fg-sub">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              className="rounded-full border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
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
              className="rounded-full border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              다음
            </button>
          </nav>
        </>
      )}
      <TableSearch userId={userId} groups={allGroups.data} />
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
