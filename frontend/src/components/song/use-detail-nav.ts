"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { tableDetailHref } from "@/components/song/TableContext";
import type { TierGroupResponse } from "@/lib/api-types";
import {
  readDetailNav,
  songsNavView,
  tableNavView,
  updateDetailNavCurrent,
  type NavStep,
  type NavView,
} from "@/lib/detail-nav";
import { DETAIL_SWIPE_RULES, type SwipeDirection } from "@/lib/folder-nav";
import { fetchFolderCharts, songListDetailHref, songListKeys, EMPTY_SONG_FILTERS } from "@/lib/song-list";
import type { SongDetailOrigin } from "@/lib/songs";
import { useSwipeNav } from "@/lib/use-swipe-nav";

const subscribeNone = () => () => {};

/** 열려 있는 창(기록 입력 등)이 있으면 스와이프를 끈다. 창은 최상위 레이어라 DOM으로 확인하는 것이 가장 확실하다 */
const dialogIsOpen = () => typeof document !== "undefined" && document.querySelector("dialog[open]") !== null;

/**
 * 곡 상세의 이전/다음 곡 이동. 들어온 목록의 기억(lib/detail-nav.ts)이 지금 보는 채보와 맞을 때만 view가 있다(= 바를 보인다).
 *  - 서열표: 이미 받아 둔 서열표 전체(groups)에 정렬·필터를 다시 적용한다. 새 요청 없음.
 *  - 곡 목록: 목록 폴더와 같은 쿼리 키로 캐시를 읽는다(캐시가 없으면 첫 페이지만 받는다). 받은 끝에서 더 있으면 다음 페이지를 받아 이어 간다.
 * 이동은 replace라서 뒤로 가기 한 번이 원래 목록이다. 전환 효과는 따로 없고 바로 이동한다(움직임 줄이기 설정과 상관없이 같다).
 */
export function useDetailNav({
  origin,
  chartId,
  userId,
  groups,
  swipeEnabled,
}: {
  origin: SongDetailOrigin;
  chartId: number | null;
  userId: number;
  groups: readonly TierGroupResponse[] | null;
  /** 이 화면의 열린 창 상태 등 렌더에서 아는 끄기 조건의 반대 */
  swipeEnabled: boolean;
}) {
  const router = useRouter();
  // 서버 렌더에는 sessionStorage가 없으므로 서버 값은 null, 브라우저에서 읽은 값으로 바뀐다
  const ctx = useSyncExternalStore(subscribeNone, readDetailNav, () => null);
  const matches = ctx !== null && chartId !== null && ctx.current === chartId && ctx.source === origin;
  const songsCtx = matches && ctx.source === "songs" && ctx.userId === userId ? ctx : null;

  const pages = useInfiniteQuery({
    queryKey: songListKeys.folder(userId, songsCtx?.lo ?? 0, songsCtx?.step ?? "0.50", songsCtx?.filters ?? EMPTY_SONG_FILTERS, songsCtx?.size ?? 1),
    queryFn: ({ pageParam, signal }) =>
      fetchFolderCharts(songsCtx?.lo ?? 0, songsCtx?.step ?? "0.50", pageParam, signal, songsCtx?.filters ?? EMPTY_SONG_FILTERS, songsCtx?.size ?? 1),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: songsCtx !== null,
    staleTime: Infinity, // 목록에서 이미 받은 것을 그대로 쓴다(기록을 저장하면 목록 쿼리 무효화로 새로 받아진다)
  });

  const view: NavView | null = useMemo(() => {
    if (chartId === null || !matches || !ctx) return null;
    if (ctx.source === "table") return groups ? tableNavView(groups, ctx, chartId) : null;
    if (!songsCtx || !pages.data) return null;
    const rows = pages.data.pages.flatMap((p) => p.content);
    const last = pages.data.pages[pages.data.pages.length - 1];
    return songsNavView(rows, last?.totalElements ?? rows.length, pages.hasNextPage, chartId);
  }, [chartId, matches, ctx, groups, songsCtx, pages.data, pages.hasNextPage]);

  const open = useCallback(
    (songId: number, nextChartId: number) => {
      updateDetailNavCurrent(nextChartId);
      try {
        window.scrollTo(0, 0);
      } catch {
        // 스크롤을 못 올려도 이동은 한다
      }
      router.replace(origin === "table" ? tableDetailHref({ songId, songDifficultyId: nextChartId }) : songListDetailHref({ songId, songDifficultyId: nextChartId }));
    },
    [router, origin],
  );

  /** 처음/끝이면 아무 일도 하지 않는다(바에서는 막힌 칸이고, 스와이프는 무반응이다). 이동했으면 true */
  const go = useCallback(
    async (direction: "prev" | "next"): Promise<boolean> => {
      const step: NavStep | null = view ? view[direction] : null;
      if (!step || chartId === null) return false;
      if (step.kind === "go") {
        open(step.songId, step.chartId);
        return true;
      }
      // 받은 끝: 다음 페이지를 받고 그 첫 채보로 간다
      const result = await pages.fetchNextPage();
      const rows = result.data?.pages.flatMap((p) => p.content) ?? [];
      const at = rows.findIndex((r) => r.songDifficultyId === chartId);
      const next = at >= 0 ? rows[at + 1] : undefined;
      if (!next) return false;
      open(next.songId, next.songDifficultyId);
      return true;
    },
    [view, chartId, open, pages],
  );

  const swipe = useSwipeNav({
    // 왼쪽으로 밀면 다음(higher), 오른쪽으로 밀면 이전(lower)
    onSwipe: (direction: SwipeDirection) => void go(direction === "higher" ? "next" : "prev"),
    enabled: swipeEnabled && view !== null,
    rules: DETAIL_SWIPE_RULES,
    isBlocked: dialogIsOpen,
    ignoreSelector: "dialog",
  });

  return { view, go, swipe, loadingMore: pages.isFetchingNextPage };
}
