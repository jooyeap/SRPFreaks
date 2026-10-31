"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pager, usePaged } from "@/components/Pager";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { usePageSize } from "@/lib/page-size";
import { FolderSection } from "@/components/songs/FolderSection";
import { SongListFilterPanel } from "@/components/songs/SongListFilterPanel";
import { SongCreateButton } from "@/components/songs/SongCreateButton";
import { SearchFocusButton } from "@/components/SearchFocusButton";
import { SongJumpCandidates } from "@/components/songs/SongJumpCandidates";
import { SongSearchBox } from "@/components/songs/SongSearchBox";
import { SongRequestLink } from "@/components/songs/SongRequestLink";
import { SongSuggestions } from "@/components/songs/SongSuggestions";
import { AverageToggle } from "@/components/table/FilterChips";
import { ApiError } from "@/lib/api";
import type { ChartFolderResponse } from "@/lib/api-types";
import {
  activeFilterCount,
  CHARTS_PAGE_SIZE,
  fetchChartFolders,
  isFiltering,
  songListKeys,
  type SongListFilters,
} from "@/lib/song-list";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

/** 서버가 준 문구가 있으면 그대로, 없으면 일반 안내(현재 언어). t는 호출하는 컴포넌트의 번역기다(훅은 컴포넌트 안에서만 부를 수 있다). */
function errorMessage(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("Songs.loadFailed");
}

/** 곡 목록 검색 입력칸의 id. 좌측 하단 고정 버튼(SearchFocusButton)이 이 칸으로 포커스를 옮긴다. */
export const SONG_SEARCH_INPUT_ID = "song-search-input";

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
  const t = useTranslations();
  const [chartSize, setChartSize] = usePageSize("songs", CHARTS_PAGE_SIZE);
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
  const total = folders.data ? t("Songs.totalSummary", { songs: folders.data.totalSongs, charts: folders.data.totalCharts }) : null;

  return (
    // 머리 줄에는 제목과 `곡 등록`만 둔다(2026-10-31). `평균 계산`·개수는 검색창 줄로, 파트·난이도·버전·초기화는 그 아래 줄로 모은다.
    <div className="flex flex-col gap-4">
      <SearchFocusButton targetId={SONG_SEARCH_INPUT_ID} />
      <div className="flex items-start justify-between gap-3 md:items-center">
        <div>
          <h1 className="text-xl font-semibold text-fg">{t("Songs.title")}</h1>
          {total ? <p className="mt-1 text-sm text-fg-sub font-num">{total}</p> : null}
        </div>
        {canRegister ? <SongCreateButton /> : null}
      </div>

      {/*
        검색·보기 설정 + 필터. 데스크톱(md 이상)은 한 카드 안에 두 줄:
        1줄 `검색창 · 평균 계산 · 개수`, 2줄 `파트 · 난이도 · 버전 · 초기화`.
        모바일은 검색 줄 아래에 `평균 계산 · 개수`가 한 줄로 내려가고, 필터는 `필터` 버튼으로 펼친다(서열표와 같은 방식).
      */}
      <div className="flex flex-col gap-4 md:gap-3 md:rounded-2xl md:border md:border-line md:bg-card md:px-4 md:py-3">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex min-w-0 flex-1 basis-60 items-center gap-2">
            <SongSearchBox id={SONG_SEARCH_INPUT_ID} value={filters.q} onCommit={(q) => onFiltersChange({ ...filters, q })} />
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="song-filters"
              onClick={() => setFiltersOpen((open) => !open)}
              className="shrink-0 rounded-lg border border-chip-line px-3 py-2 text-sm text-fg-sub hover:text-fg md:hidden"
            >
              {filterCount > 0 ? t("Songs.filterCount", { count: filterCount }) : t("Songs.filter")}
            </button>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <AverageToggle includeZero={includeZero} onChange={setIncludeZero} />
            {/* 폴더를 펼쳤을 때 `더 보기` 한 번에 보이는 채보 수. 바꾸면 펼친 폴더가 새 개수로 다시 받는다 */}
            <PageSizeSelect value={chartSize} onChange={setChartSize} />
          </div>
        </div>

        {/* 모바일: 필터 버튼으로 펼치는 패널. 데스크톱(md 이상)은 항상 보이는 둘째 줄 */}
        <SongListFilterPanel
          id="song-filters"
          className={`${filtersOpen ? "flex motion-reveal md:animate-none" : "hidden"} flex-col gap-2 rounded-2xl border border-line bg-card p-4 md:flex md:flex-row md:flex-wrap md:items-center md:gap-3 md:rounded-none md:border-0 md:bg-transparent md:p-0`}
          filters={filters}
          versions={versions}
          onChange={onFiltersChange}
        />
      </div>

      {/* 검색어에 맞는 채보의 바로가기 후보(누르면 곡 상세). 아래 폴더 목록은 같은 검색어로 걸러진다 */}
      <SongJumpCandidates userId={userId} query={filters.q} />

      {folders.isError ? (
        <ErrorRetry onRetry={() => void folders.refetch()} retrying={folders.isFetching}>
          {errorMessage(folders.error, t)}
        </ErrorRetry>
      ) : !folders.data ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : folders.data.folders.length === 0 ? (
        <div>
          <p className="text-sm text-fg-sub">{filtering ? t("Songs.noMatch") : t("Songs.noSongs")}</p>
          {filters.q.trim() !== "" ? (
            <>
              <SongSuggestions query={filters.q} onPick={(title) => onFiltersChange({ ...filters, q: title })} />
              <SongRequestLink query={filters.q} />
            </>
          ) : null}
        </div>
      ) : (
        <PagedFolders userId={userId} folders={folders.data.folders} includeZero={includeZero} filters={filters} />
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {pageItems.map((folder) => (
          <FolderSection key={folder.lo} userId={userId} folder={folder} includeZero={includeZero} filters={filters} />
        ))}
      </div>
      <Pager page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
