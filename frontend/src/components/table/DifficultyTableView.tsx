"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RecordDialog } from "@/components/record/RecordDialog";
import { Chip, FilterChips, type ChipOption } from "@/components/table/FilterChips";
import { TierGroupSection } from "@/components/table/TierGroupSection";
import { ApiError } from "@/lib/api";
import {
  EMPTY_FILTERS,
  fetchDifficultyTables,
  fetchTableEntries,
  PATTERN_OPTIONS,
  pickRatingTable,
  RECOMMEND_OPTIONS,
  tableKeys,
  type TableFilters,
} from "@/lib/difficulty-table";
import type { TableEntryResponse } from "@/lib/api-types";
import type { InstrumentPart } from "@/lib/types";

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
    filters.recommend ? `추천 ${filters.recommend}` : null,
    filters.pattern ? `속성 ${filters.pattern}` : null,
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
export function DifficultyTableView({ userId }: { userId: number }) {
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [includeZero, setIncludeZero] = useState(false); // 0% 미포함이 기본 (DESIGN-UI 3장)
  const [filtersOpen, setFiltersOpen] = useState(false); // 모바일에서 필터 패널을 접어 둔다 (데스크톱은 항상 펼침)
  const [recordTarget, setRecordTarget] = useState<TableEntryResponse | null>(null); // 기록 입력창을 연 채보

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
      <div>
        <h1 className="text-xl font-semibold text-fg">{table.name}</h1>
        <p className="mt-1 text-sm text-fg-sub">속성은 SRN, SRN+ 옵션 사용 기준</p>
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
        className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-2 rounded-xl border border-line bg-card p-3 md:flex`}
      >
        <FilterChips label="파트" options={PART_OPTIONS} selected={filters.part} onChange={(part) => changeFilter({ part })} />
        <FilterChips
          label="추천"
          options={RECOMMEND_CHIPS}
          selected={filters.recommend}
          onChange={(recommend) => changeFilter({ recommend })}
        />
        <FilterChips
          label="속성"
          options={PATTERN_CHIPS}
          selected={filters.pattern}
          onChange={(pattern) => changeFilter({ pattern })}
        />
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
              <TierGroupSection key={group.tier ?? "undecided"} group={group} includeZero={includeZero} onRecord={setRecordTarget} />
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
      <RecordDialog
        chart={
          recordTarget && {
            songDifficultyId: recordTarget.songDifficultyId,
            title: recordTarget.title,
            part: recordTarget.part,
            difficulty: recordTarget.difficulty,
            level: recordTarget.level,
          }
        }
        onClose={() => setRecordTarget(null)}
      />
    </div>
  );
}
