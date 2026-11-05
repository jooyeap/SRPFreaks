"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { TableCredit } from "@/components/TableCredit";
import { SongCreateButton } from "@/components/songs/SongCreateButton";
import { TableFilterPanel } from "@/components/table/TableFilterPanel";
import { TableSearch } from "@/components/table/TableSearch";
import { TierTileGrid, type TierTile } from "@/components/table/TierTileGrid";
import { TableTip } from "@/components/table/TableTip";
import { ApiError } from "@/lib/api";
import { tableNameLabel } from "@/lib/chart-labels";
import {
  allGroupsKey,
  decidedGroups,
  fetchAllTierGroups,
  fetchDifficultyTables,
  filterTierGroup,
  pickRatingTable,
  tableKeys,
  type TableFilters,
} from "@/lib/difficulty-table";
import { fetchMyPlayLevel, skillKeys } from "@/lib/rating";
import { DEFAULT_VIEW_STATE, type TableViewState } from "@/lib/table-view-state";
import { averageTenth, defaultOrder, type TileOrder } from "@/lib/table-tiles";
import { ErrorRetry } from "@/components/ErrorRetry";
import { isLoggedInViewer } from "@/lib/viewer";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

function errorMessage(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("Table.loadFailed");
}

/**
 * 서열표 첫 화면(2026-11-05 개편). 난이도 묶음을 타일 격자로 보여 주고, 타일을 누르면 그 난이도 폴더(/table/folder/{tier})로 간다.
 * 채보 줄·묶음 펼침·페이지는 이 화면에 없다(폴더 화면이 맡는다).
 *
 * 데이터: 난이도 바로가기와 같은 "서열표 전체 묶음"(allGroupsKey)을 한 번 받아 쓴다. 필터(추천·속성)는 서버에 다시 묻지 않고
 * 받아 둔 채보에 화면에서 적용해 타일 숫자(n/전체)를 다시 센다(filterTierGroup). 그래서 필터를 바꿔도 요청이 늘지 않는다.
 * 내 평균 난이도는 세트리스트 추천과 같은 서버 계산(`GET /skills/me/play-level`, PlayLevelEstimator)을 그대로 쓴다. 화면에서 다시 계산하지 않는다.
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
   * 필터·타일 순서(보기 상태). 서열표 페이지가 주소 쿼리에서 읽어 넘기면 폴더에 갔다 뒤로 와도 그대로 남는다.
   * 넘기지 않으면 이 컴포넌트가 스스로 갖는다(처음에는 기본 상태).
   */
  state?: TableViewState;
  onStateChange?: (next: TableViewState) => void;
}) {
  const t = useTranslations();
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
  const { filters } = view;
  const [filtersOpen, setFiltersOpen] = useState(false); // 필터 패널은 버튼으로 연다(처음에는 접혀 있다)
  const loggedIn = isLoggedInViewer(userId);

  const tables = useQuery({
    queryKey: tableKeys.list,
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    select: pickRatingTable,
  });
  const table = tables.data ?? null;

  // 서열표 전체 묶음. 홈·곡 상세·폴더 화면과 같은 키라 캐시를 함께 쓴다
  const allGroups = useQuery({
    queryKey: allGroupsKey(userId, table?.id ?? 0),
    queryFn: ({ signal }) => fetchAllTierGroups(table?.id ?? 0, signal),
    enabled: table !== null,
  });

  // 내 평균 난이도(홈 진행도 카드와 같은 키). 비로그인은 부르지 않는다. 실패하면 평균 없이 그린다
  const playLevel = useQuery({
    queryKey: skillKeys.playLevel(userId),
    queryFn: ({ signal }) => fetchMyPlayLevel(signal),
    enabled: loggedIn,
  });
  const average = playLevel.data?.status === "READY" && playLevel.data.tier !== null ? averageTenth(playLevel.data.tier) : null;

  const decided = useMemo(() => (allGroups.data ? decidedGroups(allGroups.data) : []), [allGroups.data]);
  // 기록한 채보 수(필터와 무관한 내 전체 기록). 맨 위 줄의 `기록 n곡`과 "기록 없음" 판단에 쓴다
  const recordedTotal = decided.reduce((sum, g) => sum + g.recorded, 0);
  // 타일: 곡이 있는 난이도만(필터를 적용한 뒤 0개인 난이도는 타일을 만들지 않는다). 미정 묶음은 decidedGroups가 이미 뺐다
  const tiles = useMemo<TierTile[]>(
    () =>
      decided.flatMap((g) => {
        const f = filterTierGroup(g, filters);
        return g.tier !== null && f.total > 0 ? [{ tier: g.tier, total: f.total, recorded: f.recorded }] : [];
      }),
    [decided, filters],
  );

  // 필터를 바꾸면 보기 상태만 바뀐다(타일은 화면에서 다시 센다)
  function changeFilter(next: Partial<TableFilters>) {
    updateView({ filters: { ...filters, ...next }, page: 0 });
  }

  if (tables.isPending) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (tables.isError) {
    return (
      <ErrorRetry onRetry={() => void tables.refetch()} retrying={tables.isFetching}>
        {errorMessage(tables.error, t)}
      </ErrorRetry>
    );
  }
  if (!table) {
    return <p className="text-sm text-fg-sub">{t("Home.tableEmpty")}</p>;
  }

  const order: TileOrder = view.order ?? defaultOrder(average !== null);
  const waiting = allGroups.isPending || (loggedIn && playLevel.isPending); // 평균이 늦게 도착하면 타일 배치(접힘)가 바뀌므로 둘 다 기다린다
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">{tableNameLabel(table.name, t)}</h1>
          <p className="mt-1 text-xs text-fg-dim">
            {t("Table.patternBasis")} · <TableCredit className="inline" />
          </p>
        </div>
        {/* ROOT·ADMIN만: 곡과 채보를 등록하면서 이 서열표에도 추가한다 */}
        {canRegister ? <SongCreateButton tableId={table.id} /> : null}
      </div>

      {/* 곡 검색: 한 줄 크기 검색창 + 결과(누르면 곡 상세로). 좌측 하단 고정 버튼은 이 검색창으로 포커스를 옮긴다 */}
      <TableSearch userId={userId} groups={allGroups.data && decidedGroups(allGroups.data)} />

      {allGroups.isError ? (
        <ErrorRetry onRetry={() => void allGroups.refetch()} retrying={allGroups.isFetching}>
          {errorMessage(allGroups.error, t)}
        </ErrorRetry>
      ) : waiting ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : (
        <>
          {/* 맨 위 한 줄: 평균이 있으면 `5.8 내 평균 난이도 · 기록 43곡`, 기록이 없거나 비로그인이면 시작 안내, 기록은 있는데 평균 근거가 모자라면 기록 수만 */}
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-fg-sub">
            {average !== null ? (
              <>
                <span className="font-num text-3xl font-bold leading-none text-fg">{average.toFixed(1)}</span>
                <span>{t("Table.tilesMyAverage")}</span>
                <span aria-hidden="true">·</span>
                <span>{t("Table.tilesRecordedCount", { count: recordedTotal })}</span>
              </>
            ) : recordedTotal > 0 ? (
              <span>{t("Table.tilesRecordedCount", { count: recordedTotal })}</span>
            ) : (
              <span className="text-base font-semibold text-fg">{t("Table.tilesStartHint")}</span>
            )}
          </p>

          <TableTip />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label={t("Table.tilesOrderLabel")} className="inline-flex rounded-lg border border-line bg-table-head p-0.5">
              {(["hard", "easy"] as const).map((value) => {
                const on = order === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => updateView({ order: value })}
                    className={`min-h-[34px] rounded-lg px-3 py-0.5 text-sm ${on ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-dim hover:text-fg"}`}
                  >
                    {t(value === "hard" ? "Table.tilesOrderHard" : "Table.tilesOrderEasy")}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="table-filters"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex min-h-[34px] items-center gap-1.5 rounded-lg border border-ctl bg-card px-3 text-sm text-fg hover:bg-table-head"
            >
              {t("Songs.filter")}
              <span aria-hidden="true">{filtersOpen ? "▴" : "▾"}</span>
            </button>
          </div>
          {filtersOpen ? (
            <div id="table-filters" className="motion-reveal flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-2">
              <TableFilterPanel filters={filters} onChange={changeFilter} />
            </div>
          ) : null}

          {tiles.length === 0 ? (
            <p className="text-sm text-fg-sub">{t("Songs.noMatch")}</p>
          ) : (
            // key: 순서나 필터가 바뀌면 접힘 상태를 처음(접힘)으로 돌린다
            <TierTileGrid key={`${order}|${filters.recommend.join()}|${filters.pattern.join()}`} tiles={tiles} average={average} order={order} label={t("Table.tierList")} />
          )}
        </>
      )}
      <ScrollTopButton />
    </div>
  );
}
