"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pager, usePaged } from "@/components/Pager";
import { FolderSection } from "@/components/songs/FolderSection";
import { SongListFilterPanel } from "@/components/songs/SongListFilterPanel";
import { SongCreateButton } from "@/components/songs/SongCreateButton";
import { SongSearchBox } from "@/components/songs/SongSearchBox";
import { SongRequestLink } from "@/components/songs/SongRequestLink";
import { SongSuggestions } from "@/components/songs/SongSuggestions";
import { AverageToggle } from "@/components/table/FilterChips";
import { ApiError } from "@/lib/api";
import type { ChartFolderResponse } from "@/lib/api-types";
import {
  activeFilterCount,
  fetchChartFolders,
  isFiltering,
  songListKeys,
  type SongListFilters,
} from "@/lib/song-list";

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "곡 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 전체 곡 목록 (DESIGN-UI 9장). 레벨 폴더(0.5 단위) 목록이고, 검색하거나 필터를 쓰면 조건에 맞는 채보만으로 폴더가 다시 만들어진다(폴더는 유지).
 * 조건(filters)은 주소 쿼리가 갖고 있어 부모가 넘겨 준다(새로고침·뒤로 가기·링크 공유가 같은 화면을 만든다).
 * 로그인한 사용자만 그린다(내 기록을 함께 보여 주므로). userId는 쿼리 키에만 쓴다 — 계정이 바뀌어도 이전 사용자의 캐시를 보지 않게 한다.
 */
export function SongListView({
  userId,
  filters,
  onFiltersChange,
  canRegister = false,
}: {
  userId: number;
  filters: SongListFilters;
  onFiltersChange: (next: SongListFilters) => void;
  /** ROOT·ADMIN이면 true. `곡 등록` 버튼을 보여 준다. 서버도 권한을 다시 검사한다. */
  canRegister?: boolean;
}) {
  const [includeZero, setIncludeZero] = useState(false); // 0% 미포함이 기본 (DESIGN-UI 3장)
  const [filtersOpen, setFiltersOpen] = useState(false); // 모바일에서 필터 패널을 접어 둔다 (데스크톱은 항상 펼침)

  const folders = useQuery({
    queryKey: songListKeys.folders(userId, filters),
    queryFn: ({ signal }) => fetchChartFolders(signal, filters),
    // 필터를 바꾸는 동안 이전 목록을 잠깐 유지한다(버전 선택지·화면이 깜박이지 않게)
    placeholderData: keepPreviousData,
  });
  const filtering = isFiltering(filters);

  const filterCount = activeFilterCount(filters);
  const versions = folders.data?.versions ?? [];
  const total = folders.data ? `${folders.data.totalSongs}곡 · ${folders.data.totalCharts}개` : null;

  return (
    // 모바일은 세로 한 줄(flex-col). 데스크톱(md 이상)은 2열 격자로 바꿔 제목 줄 오른쪽 끝에 `평균 계산` 토글을 둔다(시안). 제목 줄도 md에서는 세로 가운데 정렬이라 `곡 등록` 버튼과 토글의 높이·세로 위치가 같다.
    // 토글은 DOM에서는 폴더 목록 바로 위(모바일 위치)에 그대로 두고, 격자 자리만 CSS로 제목 줄 오른쪽(md:col-start-2 md:row-start-1)으로 옮긴다.
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_auto] md:items-start md:gap-x-3">
      <div className="flex items-start justify-between gap-3 md:col-start-1 md:row-start-1 md:items-center">
        <div>
          <h1 className="text-xl font-semibold text-fg">곡 목록</h1>
          {total ? <p className="mt-1 text-sm text-fg-sub font-num">{total}</p> : null}
        </div>
        {canRegister ? <SongCreateButton /> : null}
      </div>

      {/*
        검색창 + 필터. 모바일: 검색 줄과 접이식 필터 패널이 따로 있다(gap-4로 이전과 같은 간격).
        데스크톱(md 이상): 한 카드 안에 `검색창 · 파트 · 난이도 · 버전 · 초기화`가 한 줄로 놓인다(시안).
        안쪽 두 묶음은 md:contents로 "없는 것처럼" 풀어서 자식들이 이 카드의 칸이 되게 한다.
      */}
      <div className="flex flex-col gap-4 md:col-span-2 md:flex-row md:flex-wrap md:items-center md:gap-3 md:rounded-2xl md:border md:border-line md:bg-card md:px-4 md:py-3">
        <div className="flex items-center gap-2 md:contents">
          <SongSearchBox value={filters.q} onCommit={(q) => onFiltersChange({ ...filters, q })} />
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="song-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className="shrink-0 rounded-lg border border-chip-line px-3 py-2 text-sm text-fg-sub hover:text-fg md:hidden"
          >
            {filterCount > 0 ? `필터 ${filterCount}` : "필터"}
          </button>
        </div>

        {/* 모바일: 필터 버튼으로 펼치는 패널. 데스크톱(md 이상)은 항상 보인다. (시안의 아래에서 올라오는 시트 대신 접이식 패널을 쓴다 — 서열표 필터와 같은 방식) */}
        <SongListFilterPanel
          id="song-filters"
          className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-2 rounded-2xl border border-line bg-card p-4 md:contents`}
          filters={filters}
          versions={versions}
          onChange={onFiltersChange}
        />
      </div>

      {folders.isError ? (
        <p role="alert" className="text-sm text-fg md:col-span-2">{errorMessage(folders.error)}</p>
      ) : !folders.data ? (
        <p className="text-sm text-fg-sub md:col-span-2">불러오는 중입니다.</p>
      ) : folders.data.folders.length === 0 ? (
        <div className="md:col-span-2">
          <p className="text-sm text-fg-sub">{filtering ? "조건에 맞는 채보가 없습니다." : "등록된 곡이 아직 없습니다."}</p>
          {filters.q.trim() !== "" ? (
            <>
              <SongSuggestions query={filters.q} onPick={(title) => onFiltersChange({ ...filters, q: title })} />
              <SongRequestLink query={filters.q} />
            </>
          ) : null}
        </div>
      ) : (
        <>
          <div className="md:col-start-2 md:row-start-1 md:self-center">
            <AverageToggle includeZero={includeZero} onChange={setIncludeZero} />
          </div>
          <PagedFolders userId={userId} folders={folders.data.folders} includeZero={includeZero} filters={filters} />
        </>
      )}
    </div>
  );
}

/** 레벨 폴더가 많아 10개씩 나눠 보여 준다. 필터를 바꿔 폴더 수가 줄면 마지막 페이지로 당겨진다(usePaged). */
function PagedFolders({
  userId,
  folders,
  includeZero,
  filters,
}: {
  userId: number;
  folders: readonly ChartFolderResponse[];
  includeZero: boolean;
  filters: SongListFilters;
}) {
  const { page, totalPages, pageItems, setPage } = usePaged(folders);
  // 폴더 목록과 페이지 이동을 한 묶음(gap-4 = 이전 간격)으로 두고, 데스크톱 격자에서는 두 열을 모두 차지한다
  return (
    <div className="flex flex-col gap-4 md:col-span-2">
      <div className="flex flex-col gap-3">
        {pageItems.map((folder) => (
          <FolderSection key={folder.lo} userId={userId} folder={folder} includeZero={includeZero} filters={filters} />
        ))}
      </div>
      <Pager page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
