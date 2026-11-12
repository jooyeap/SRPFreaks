"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RecordDialog } from "@/components/record/RecordDialog";
import { AverageToggle } from "@/components/table/FilterChips";
import { SortSelect } from "@/components/table/SortSelect";
import { filterSummary, TableFilterPanel } from "@/components/table/TableFilterPanel";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { TableSearch } from "@/components/table/TableSearch";
import { FolderHeader } from "@/components/table/FolderHeader";
import { FolderNeighborBar } from "@/components/table/FolderNeighborBar";
import { TierFolderNav } from "@/components/table/TierFolderNav";
import { TierGroupSection } from "@/components/table/TierGroupSection";
import { FolderThresholdNote } from "@/components/table/FolderThresholdNote";
import { ApiError } from "@/lib/api";
import {
  allGroupsKey,
  decidedGroups,
  fetchAllTierGroups,
  fetchDifficultyTables,
  filterTierGroup,
  findGroupByParam,
  folderHref,
  hasFilters,
  pickRatingTable,
  tableKeys,
  type TableFilters,
} from "@/lib/difficulty-table";
import { chartIdOfDetailLink, rememberDetailNav } from "@/lib/detail-nav";
import { dragOffsetPx, dragPassed, FOLDER_SWIPE_RULES, neighborGroups, type SwipeDirection } from "@/lib/folder-nav";
import { alignListHead, requestFolderScrollAdjust, stickyTopOffset, takeFolderScrollAdjust } from "@/lib/folder-scroll";
import { formatTier } from "@/lib/format";
import { fetchMyPlayLevel, skillKeys } from "@/lib/rating";
import { DEFAULT_SORT, sortEntries, type TableSort } from "@/lib/table-sort";
import { averageTenth, layoutTiles } from "@/lib/table-tiles";
import { folderStartFilters, tableReturnHref } from "@/lib/table-view-state";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSwipeNav } from "@/lib/use-swipe-nav";
import type { TableEntryResponse } from "@/lib/api-types";
import { ErrorRetry } from "@/components/ErrorRetry";
import { isLoggedInViewer } from "@/lib/viewer";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";

/** 이웃 목록으로 넘어가는 애니메이션 시간(ms). 놓았을 때 80px 이상이면 이 시간 동안 밀려 나가고 들어온다 */
const LEAVE_MS = 200;
/** 80px 미만으로 놓았을 때 제자리로 돌아오는 시간(ms) */
const RETURN_MS = 150;
/** 현재 목록과 이웃 목록 사이 간격(px) */
const NEIGHBOR_GAP_PX = 16;
/** 끌 때 옆에 미리 그리는 이웃 난이도의 곡 줄 수. 전부 그리지 않는다(옆에 살짝 보이는 용도) */
const NEIGHBOR_PREVIEW_ROWS = 8;
/** 이웃으로 옮기는 중 이동이 끝나지 않았을 때(화면이 그대로일 때) 끌려 간 목록을 제자리로 돌리는 대기(ms) */
const STUCK_RESET_MS = 800;

/**
 * 끌기 상태. side는 손가락이 향하는 쪽의 이웃(왼쪽으로 끌면 "higher" = 더 높은 난이도), passed는 80px를 넘었는지.
 * phase: dragging(끌고 있음) / leaving(80px 이상 놓아서 이웃이 들어오는 중) / returning(80px 미만으로 놓아 돌아오는 중).
 * 이 state는 쪽이 바뀌거나 80px를 넘나들 때만 바뀐다(손가락이 움직일 때마다 렌더하지 않는다. 목록의 움직임은 ref로 style을 직접 쓴다).
 */
interface DragState {
  side: SwipeDirection;
  passed: boolean;
  phase: "dragging" | "leaving" | "returning";
}

function errorMessage(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("Table.groupLoadFailed");
}

/**
 * 서열표 묶음 하나(기준 난이도 하나)를 따로 보는 화면. `/table/folder/5.8`.
 * 곡 상세의 "같은 난이도의 곡 → 묶음 전체 보기"에서 들어온다.
 * 곡 상세와 같은 쿼리 키(allGroupsKey)를 써서, 곡 상세에서 이미 받은 서열표를 다시 받지 않고 재사용한다.
 * 서열표에서 묶음 하나만 달라는 서버 API는 따로 없어서(묶음 단위 페이지만 있다) 전체를 받아 해당 묶음만 고른다.
 * 파트·추천·속성 필터도 같은 이유로 화면에서 건다(filterTierGroup). 머리의 개수·평균은 걸러진 채보 기준이다.
 *
 * 2026-11-05(PR 2) 정리:
 *  - 머리는 `←` + 큰 난이도 숫자 + `기록 n/전체`(내 평균 난이도면 그 글자). 칩 띠는 그대로, 머리의 `‹ ›`는 없앴다.
 *  - 이웃 난이도 이동: 화면 아래 고정 버튼 + 곡 목록 영역의 좌우 스와이프. 모두 replace(뒤로 가기 한 번이 서열표).
 *  - n/전체 계산: 서열표 타일은 서열표의 필터(처음엔 추천 상·중)로 센 값이다. 폴더의 머리·이웃 버튼·칩 띠도 **같은 필터로** 세야 타일 숫자와 어긋나지 않는다.
 *    그래서 서열표에서 타일을 눌러 들어오면 그때의 서열표 필터로 시작한다(folderStartFilters). 다른 길(곡 상세 등)로 오면 필터 없이(묶음 전체) 시작한다.
 *    폴더 안에서 필터를 바꾸면 이 폴더 화면에만 적용되고(이동하면 다시 시작 필터), 서열표 필터는 바뀌지 않는다.
 */
export function TierFolderView({ userId, param }: { userId: number; param: string }) {
  const t = useTranslations();
  const [includeZero, setIncludeZero] = useState(false);
  const [sort, setSort] = useState<TableSort>(DEFAULT_SORT);
  const [filters, setFilters] = useState<TableFilters>(folderStartFilters); // 서열표에서 눌러 들어왔으면 그때의 필터, 아니면 없음
  const router = useRouter();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [drag, setDrag] = useState<DragState | null>(null);
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

  // 내 평균 난이도(서열표 타일 화면·홈과 같은 서버 값). 비로그인은 부르지 않고, 실패하거나 늦으면 평균 글자만 없다
  const playLevel = useQuery({
    queryKey: skillKeys.playLevel(userId),
    queryFn: ({ signal }) => fetchMyPlayLevel(signal),
    enabled: isLoggedInViewer(userId),
  });
  const average = playLevel.data?.status === "READY" && playLevel.data.tier !== null ? averageTenth(playLevel.data.tier) : null;

  const rawGroup = useMemo(() => (groups.data ? findGroupByParam(groups.data, param) : null), [groups.data, param]);
  const group = useMemo(() => (rawGroup ? filterTierGroup(rawGroup, filters) : null), [rawGroup, filters]);

  // 칩 띠·이웃 버튼이 쓰는 난이도 목록: 서열표 타일과 같은 규칙(같은 필터로 센 n/전체, 곡이 있는 난이도만, 미정 제외).
  // 지금 보는 난이도는 필터로 0개가 되어도 남겨서 이동 기준이 사라지지 않게 한다
  const filteredGroups = useMemo(
    () => (groups.data ?? []).map((g) => filterTierGroup(g, filters)).filter((g) => g.tier !== null && (g.total > 0 || g.tier === rawGroup?.tier)),
    [groups.data, filters, rawGroup],
  );
  const neighbors = useMemo(() => neighborGroups(filteredGroups, rawGroup?.tier ?? null), [filteredGroups, rawGroup]);
  const averageTier = useMemo(
    () =>
      layoutTiles(
        filteredGroups.flatMap((g) => (g.tier !== null && g.total > 0 ? [{ tier: g.tier }] : [])),
        average,
        "hard",
      ).averageTier,
    [filteredGroups, average],
  );

  // ---- 이웃 난이도 스와이프 + 끌기 모션 (D68) ----
  // 목록 영역(slider)은 가로로 잠긴 뒤에만 손가락을 따라 움직인다. 움직임은 state가 아니라 ref로 style.transform을 직접 쓴다
  // (손가락이 움직일 때마다 React를 렌더하면 끊긴다). 렌더는 쪽이 바뀌거나 80px를 넘나들 때만 일어난다(drag state).
  const sliderRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const busyRef = useRef(false); // 이웃으로 넘어가는 중이거나 제자리로 돌아오는 중이면 새 쓸기를 받지 않는다
  const timersRef = useRef<number[]>([]);

  function later(ms: number, fn: () => void) {
    timersRef.current.push(window.setTimeout(fn, ms));
  }
  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  /** 목록을 offset(px)만큼 옮긴다. 한 프레임에 한 번만 쓴다(requestAnimationFrame으로 묶음) */
  function paint(offset: number) {
    offsetRef.current = offset;
    if (typeof requestAnimationFrame !== "function") {
      if (sliderRef.current) sliderRef.current.style.transform = `translateX(${offset}px)`;
      return;
    }
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (sliderRef.current) sliderRef.current.style.transform = `translateX(${offsetRef.current}px)`;
    });
  }
  /** 대기 중인 프레임을 취소하고 style을 직접 쓴다(놓은 뒤의 애니메이션용) */
  function setSliderStyle(transform: string, transition: string) {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const slider = sliderRef.current;
    if (!slider) return;
    slider.style.transition = transition;
    slider.style.transform = transform;
  }
  function clearSlider() {
    setSliderStyle("", "");
    sliderRef.current?.style.removeProperty("transform");
    sliderRef.current?.style.removeProperty("transition");
  }

  /** 이웃 난이도로 이동한다. replace(뒤로 가기 한 번이 서열표)이고 맨 위로 올리지 않는다(scroll: false). 이동 직후의 스크롤 맞춤은 새 화면이 표시를 보고 한다(folder-scroll) */
  function goTo(target: { tier: number | null }) {
    requestFolderScrollAdjust();
    router.replace(folderHref(target.tier), { scroll: false });
    // 화면이 바뀌면 이 컴포넌트는 사라진다. 혹시 안 바뀌었으면 끌려 간 목록을 제자리로 돌려 화면이 비지 않게 한다
    later(STUCK_RESET_MS, () => {
      clearSlider();
      busyRef.current = false;
      setDrag(null);
    });
  }
  /** 제자리로 돌아간다(80px 미만이거나 끝 난이도) */
  function settleBack() {
    if (reduced || !sliderRef.current) {
      clearSlider();
      setDrag(null);
      return;
    }
    busyRef.current = true;
    setDrag((current) => (current ? { ...current, passed: false, phase: "returning" } : current));
    setSliderStyle("translateX(0px)", `transform ${RETURN_MS}ms var(--ease-out)`);
    later(RETURN_MS, () => {
      clearSlider();
      busyRef.current = false;
      setDrag(null);
    });
  }

  function onDrag(dx: number) {
    if (busyRef.current) return;
    const side: SwipeDirection = dx < 0 ? "higher" : "lower";
    const target = neighbors[side];
    // 움직임 줄이기: 목록은 움직이지 않는다(타일 테두리·스테퍼·알약만 보인다)
    if (!reduced) paint(dragOffsetPx(dx, target !== null));
    const passed = target !== null && dragPassed(dx);
    setDrag((current) =>
      current && current.side === side && current.passed === passed && current.phase === "dragging" ? current : { side, passed, phase: "dragging" },
    );
  }

  function onDragEnd(direction: SwipeDirection | null) {
    const target = direction ? neighbors[direction] : null;
    if (!direction || !target) {
      settleBack(); // 80px 미만·비낀 각도·취소, 또는 끝 난이도(갈 곳이 없다)
      return;
    }
    const slider = sliderRef.current;
    if (reduced || !slider) {
      goTo(target); // 움직임 줄이기: 즉시 이동
      return;
    }
    // 현재 목록이 반대쪽으로 밀려 나가고 이웃 목록이 들어온다. 끝나면 주소를 바꾼다.
    // 새 난이도 화면은 새로 마운트되어 transform 없이 그려지므로, 같은 프레임에 초기화되어 깜빡이지 않는다
    busyRef.current = true;
    setDrag({ side: direction, passed: true, phase: "leaving" });
    const distance = slider.offsetWidth + NEIGHBOR_GAP_PX;
    setSliderStyle(`translateX(${direction === "higher" ? -distance : distance}px)`, `transform ${LEAVE_MS}ms var(--ease-out)`);
    later(LEAVE_MS, () => goTo(target));
  }

  // 손가락 없이 시작→끝만 온 쓸기(끌기를 시작하지 않은 경우)는 애니메이션 없이 바로 이동한다
  function onSwipe(direction: SwipeDirection) {
    const target = neighbors[direction];
    if (target) goTo(target);
  }
  const swipe = useSwipeNav({ onSwipe, rules: FOLDER_SWIPE_RULES, onDrag, onDragEnd, isBlocked: () => busyRef.current });

  // 끌 때 옆에 보여 줄 이웃 난이도(곡 줄 첫 NEIGHBOR_PREVIEW_ROWS개만). 데이터는 이미 받아 둔 groups다. 움직임 줄이기에서는 그리지 않는다
  const dragTarget = drag ? neighbors[drag.side] : null;
  const neighborPreview = useMemo(
    () => (dragTarget ? { ...dragTarget, entries: sortEntries(dragTarget.entries, sort).slice(0, NEIGHBOR_PREVIEW_ROWS) } : null),
    [dragTarget, sort],
  );

  // 알약은 곡 줄의 `+` 버튼을 가리지 않게 줄과 줄 사이(경계선)에 둔다: 지금 보이는 구간 가운데에 가장 가까운 줄 경계의 높이로 맞춘다.
  // 보이는 구간 안에 줄 경계가 없으면(목록 머리만 보일 때 등) 목록 영역 위쪽에 둔다. 끌기 중에는 스크롤이 취소 조건이라 이 값이 도중에 어긋나지 않는다
  useLayoutEffect(() => {
    const pill = pillRef.current;
    const area = sliderRef.current?.parentElement;
    const current = currentRef.current;
    if (!drag || drag.phase !== "dragging" || !pill || !area || !current) return;
    const areaTop = area.getBoundingClientRect().top;
    const visibleTop = Math.max(areaTop, stickyTopOffset()) + 24;
    const visibleBottom = window.innerHeight - 160; // 아래 고정 스테퍼(67px)·하단 탭바·여유
    const middle = (visibleTop + visibleBottom) / 2;
    let best: number | null = null;
    current.querySelectorAll("section ul > li").forEach((li) => {
      const rect = li.getBoundingClientRect();
      if (rect.height === 0 || rect.bottom < visibleTop || rect.bottom > visibleBottom) return; // 숨겨진 쪽(모바일 줄/데스크톱 표) 또는 보이는 구간 밖
      if (best === null || Math.abs(rect.bottom - middle) < Math.abs(best - middle)) best = rect.bottom;
    });
    pill.style.top = `${Math.max(24, (best ?? visibleTop) - areaTop)}px`;
  }, [drag?.side, drag?.phase]); // eslint-disable-line react-hooks/exhaustive-deps -- 쪽이 바뀔 때만 다시 잰다(drag의 passed는 위치와 무관)

  // 이웃으로 옮겨 온 직후: 보던 스크롤이 새 목록 머리보다 아래였으면 머리가 고정 헤더 바로 아래에 오게 올린다(머리가 보이면 그대로 둔다).
  // 난이도마다 화면이 새로 마운트되므로(page.tsx의 key) 이동 직전에 남긴 표시로만 "옮겨 옴"을 구분한다(folder-scroll)
  useLayoutEffect(() => {
    if (!rawGroup || !currentRef.current) return;
    if (takeFolderScrollAdjust()) alignListHead(currentRef.current);
  }, [rawGroup?.tier]); // eslint-disable-line react-hooks/exhaustive-deps -- 난이도가 정해졌을 때 한 번

  const back = (
    <Link
      href={tableReturnHref()}
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
      <FolderHeader
        tier={rawGroup.tier}
        recorded={group.recorded}
        total={group.total}
        isAverage={averageTier !== null && averageTier === rawGroup.tier}
        backHref={tableReturnHref()}
      />
      <TierFolderNav
        groups={filteredGroups}
        currentTier={rawGroup.tier}
        dragHint={drag?.phase === "dragging" && dragTarget ? { tier: dragTarget.tier, strong: drag.passed } : null}
      />
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
      {/* 곡 목록 영역: 좌우로 쓸면 이웃 난이도로 간다(D68: 가로로 잠긴 뒤 80px 이상·가로축 30° 이내·가장자리 24px 제외). 세로 스크롤은 브라우저에 맡긴다(touch-pan-y).
          가로로 잠긴 뒤에만 목록(slider)이 손가락을 따라 절반만큼 움직이고, 옆에 이웃 난이도 목록(첫 8줄)이 보인다. 이웃 목록은 누를 수 없다(aria-hidden·inert).
          입력 칸·가로로 스크롤되는 영역 위에서는 시작하지 않는다(useSwipeNav). 난이도 칩 띠는 이 영역 밖이라 칩 띠 스크롤이 그대로다.
          overflow-x-clip: 옆으로 밀려 나간 목록이 페이지에 가로 스크롤을 만들지 않게 자른다(세로는 그대로) */}
      <div
        {...swipe}
        // 곡 링크를 누르면 이 목록의 정렬·필터를 기억해 둔다 -> 곡 상세의 이전/다음 곡 이동이 같은 순서로 이웃을 찾는다(lib/detail-nav.ts)
        onClick={(e) => {
          const chartId = chartIdOfDetailLink(e.target);
          if (chartId !== null) rememberDetailNav({ source: "table", sort, filters, current: chartId });
        }}
        data-testid="folder-swipe-area"
        className="relative min-h-[40vh] touch-pan-y overflow-x-clip"
      >
        <div ref={sliderRef} data-testid="folder-slider" className="relative flex min-h-[40vh] flex-col gap-4 will-change-transform">
          <div ref={currentRef} className="flex flex-col gap-4">
            {hasFilters(filters) && group.entries.length === 0 ? (
              <p className="text-sm text-fg-sub">{t("Songs.noMatch")}</p>
            ) : null}
            <TierGroupSection
              group={group}
              includeZero={includeZero}
              sort={sort}
              showRecord={isLoggedInViewer(userId)}
              onRecord={isLoggedInViewer(userId) ? (entry, tier) => setRecordTarget({ entry, tier }) : undefined}
            />
          </div>
          {neighborPreview && !reduced ? (
            <div
              aria-hidden="true"
              inert
              data-testid="folder-neighbor-list"
              className="absolute inset-y-0 w-full overflow-hidden"
              style={drag?.side === "higher" ? { left: `calc(100% + ${NEIGHBOR_GAP_PX}px)` } : { right: `calc(100% + ${NEIGHBOR_GAP_PX}px)` }}
            >
              <TierGroupSection group={neighborPreview} includeZero={includeZero} sort={sort} showRecord={isLoggedInViewer(userId)} />
            </div>
          ) : null}
        </div>
        {drag?.phase === "dragging" ? <DragPill ref={pillRef} side={drag.side} passed={drag.passed} target={dragTarget} /> : null}
      </div>
      {/* 아래 고정 이웃 난이도 버튼에 마지막 줄이 가려지지 않게 그 높이만큼 비운다 */}
      <div aria-hidden="true" className="h-[67px]" />
      <FolderNeighborBar
        neighbors={neighbors}
        tier={rawGroup.tier}
        recorded={group.recorded}
        total={group.total}
        selectedSide={drag?.phase === "dragging" && drag.passed ? drag.side : null}
      />
      <ScrollTopButton lifted />
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

/**
 * 끌기 중 목록 옆에 뜨는 알약(D68). 기존 칩 모양(테두리 알약)을 재사용한다.
 *  - 이웃이 있을 때: 왼쪽으로 끌면(오른쪽 끝) `5.7 ›`, 오른쪽으로 끌면(왼쪽 끝) `‹ 5.5`. 80px를 넘기면 작은 글자 `놓으면 이동`이 붙고 테두리가 진해진다.
 *  - 끝 난이도(이웃 없음): `마지막 난이도`. 놓으면 제자리로 돌아온다.
 * 세로 위치는 부모가 곡 줄 경계에 맞춰 style.top으로 쓴다(곡 줄의 `+` 버튼을 가리지 않게). 장식이라 화면 읽기에서는 숨기고 누를 수 없다.
 */
function DragPill({
  ref,
  side,
  passed,
  target,
}: {
  ref: React.Ref<HTMLDivElement>;
  side: SwipeDirection;
  passed: boolean;
  target: { tier: number | null } | null;
}) {
  const t = useTranslations();
  const edge = side === "higher" ? "right-1" : "left-1";
  const label = target ? formatTier(target.tier, t) : null;
  return (
    <div ref={ref} aria-hidden="true" data-testid="folder-drag-pill" data-passed={passed ? "true" : undefined} className={`pointer-events-none absolute z-10 -translate-y-1/2 ${edge}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold text-fg ${
          passed ? "border-chip-on-bg" : "border-ctl"
        }`}
      >
        {label === null ? (
          t("Table.lastTier")
        ) : (
          <>
            <span className="font-num">{side === "higher" ? `${label} ›` : `‹ ${label}`}</span>
            {passed ? <span className="text-[10px] font-normal text-fg-sub">{t("Table.releaseToMove")}</span> : null}
          </>
        )}
      </span>
    </div>
  );
}
