"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import { SongJumpCandidates } from "@/components/songs/SongJumpCandidates";
import { SongSearchBox } from "@/components/songs/SongSearchBox";
import { SongSuggestions } from "@/components/songs/SongSuggestions";
import { HEADER_HOME_SEARCH_SLOT_ID } from "@/lib/header-slots";
import { CANDIDATES_SIZE, fetchChartCandidates } from "@/lib/song-list";
import { useExitPresence } from "@/lib/use-exit-presence";
import { useHistoryClose } from "@/lib/use-history-close";

/** 오버레이 안 검색 입력칸의 id. 열리면 여기로 포커스를 준다 */
export const HOME_SEARCH_INPUT_ID = "home-song-search-input";

/**
 * 홈 헤더의 곡 검색 돋보기와 검색 오버레이 (D100).
 *
 * 왜 `/songs`로 이동하지 않고 오버레이인가: 홈은 대시보드(진행도·레이팅)라서 검색 한 번에 화면을 떠났다가 돌아오면 스크롤·탭 상태가 사라진다.
 * 또 곡 목록 화면에는 이미 검색창이 있어서 거기로 보내면 "돋보기 → 같은 입력칸"이 한 번 더 걸린다. 오버레이는 홈 위에서 바로 입력하고,
 * 결과를 누르면 곡 상세로 가며, 닫으면 홈이 그대로 남는다. 검색 로직은 새로 만들지 않고 곡 목록의 부품을 그대로 쓴다:
 * SongSearchBox(300ms 디바운스) · SongJumpCandidates(GET /songs/charts, 8건, 누르면 곡 상세) · SongSuggestions(오타·가타카나 보정 추천어).
 *
 * 열고 닫는 동작은 기존 창(ConfirmDialog·RecordDialog)과 같은 방식이다. 브라우저 <dialog>(showModal)가 포커스 가두기·Esc·바깥 배경 비활성화를,
 * useHistoryClose가 휴대폰 뒤로 가기로 창만 닫기를, useExitPresence가 닫힘 모션을 맡는다. <dialog>는 top layer라 하단 탭바 위에 뜨고 겹치지 않는다.
 *
 * 로그인 여부: 곡 검색 API(/songs/charts, /songs/suggest)는 비로그인 공개 읽기(D43)라서 로그인 전 홈에서도 같은 동작이다.
 * userId는 결과에 섞이는 "내 기록"의 캐시 키로만 쓰며 비로그인은 0이다(서버가 mine을 주지 않는다).
 */
export function HomeSongSearch({ userId }: { userId: number }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  // 헤더 자리는 브라우저에서만 찾을 수 있다. SearchFocusButton과 같이 useSyncExternalStore로 읽어 effect 안 setState를 피한다
  const slot = useSyncExternalStore(subscribeNothing, findSlot, () => null);

  return (
    <>
      {slot
        ? createPortal(
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t("Songs.searchAria")}
              title={t("Songs.searchAria")}
              aria-haspopup="dialog"
              data-home-search=""
              // 터치 영역 44px. 헤더 높이가 늘지 않도록 음수 여백으로 눈에 보이는 줄 높이는 기존 버튼(36px)과 비슷하게 둔다
              className="-my-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg hover:bg-table-head"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>,
            slot,
          )
        : null}
      <SearchOverlay open={open} userId={userId} onClose={() => setOpen(false)} />
    </>
  );
}

function SearchOverlay({ open, userId, onClose }: { open: boolean; userId: number; onClose: () => void }) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  useHistoryClose(open, onClose);
  const exit = useExitPresence(open, { onRequestClose: onClose });

  useEffect(() => {
    const dialog = ref.current;
    if (!exit.present || !dialog) {
      return;
    }
    // 일부 환경(테스트용 가짜 브라우저)에는 showModal이 없어서 open 속성으로 대신한다
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    document.getElementById(HOME_SEARCH_INPUT_ID)?.focus();
  }, [exit.present]);

  if (!exit.present) {
    return null;
  }
  return (
    <dialog
      ref={ref}
      aria-label={t("Home.searchTitle")}
      onClose={onClose}
      {...exit.dialogProps}
      // type="search" 입력칸은 글자가 있을 때 Esc를 "지우기"로 먼저 쓰고 창은 닫지 않는다(브라우저 기본 동작). 검색 오버레이에서는
      // Esc 한 번에 닫혀야 하므로 keydown에서 직접 닫는다. preventDefault로 입력칸 지우기와 cancel 이벤트의 이중 처리를 막는다.
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      // 큰 화면(md 이상)은 위쪽 가운데의 패널, 모바일은 전체 화면. 바깥(::backdrop) 클릭은 dialog 자신이 target이 된다
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
      className="fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none flex-col bg-page p-0 text-fg backdrop:bg-black/60 md:inset-x-0 md:bottom-auto md:top-[8vh] md:mx-auto md:h-auto md:max-h-[84vh] md:max-w-xl md:rounded-2xl md:border md:border-line md:bg-card"
    >
      {/* 열려 있을 때만 안쪽을 그려서, 닫았다 다시 열면 검색어가 비어 있다 */}
      <SearchPanel userId={userId} onClose={onClose} />
    </dialog>
  );
}

function SearchPanel({ userId, onClose }: { userId: number; onClose: () => void }) {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const term = q.trim();

  // SongJumpCandidates와 같은 쿼리 키라서 요청은 한 번만 나간다(캐시 공유). 여기서는 "비었는지·실패했는지·더 있는지"를 알기 위해서만 읽는다.
  const result = useQuery({
    queryKey: ["song-list", "candidates", userId, term],
    queryFn: ({ signal }) => fetchChartCandidates(term, signal),
    enabled: term !== "",
  });
  const hasMore = (result.data?.totalElements ?? 0) > CANDIDATES_SIZE;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-3">
        <SongSearchBox id={HOME_SEARCH_INPUT_ID} value={q} onCommit={setQ} />
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-lg border border-chip-line px-3 text-sm text-fg hover:bg-table-head"
        >
          {t("Common.close")}
        </button>
      </div>

      {/* 결과가 길어도 입력칸은 위에 남도록 이 영역만 스크롤한다 */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {term === "" ? (
          <p className="text-sm text-fg-sub">{t("Home.searchHint")}</p>
        ) : result.isError ? (
          <ErrorRetry onRetry={() => void result.refetch()} retrying={result.isFetching}>
            {t("Home.searchFailed")}
          </ErrorRetry>
        ) : result.isPending ? (
          <p className="text-sm text-fg-sub">{t("Home.searching")}</p>
        ) : result.data.content.length === 0 ? (
          <div>
            <p className="text-sm text-fg-sub">{t("Home.searchNoResults")}</p>
            <SongSuggestions query={term} onPick={setQ} />
          </div>
        ) : (
          <>
            {/* 결과 줄은 곡 목록과 같은 모양(곡명·채보 배지·내 달성 단계). 누르면 곡 상세로 가고, 창은 history 규칙에 따라 정리된다 */}
            <SongJumpCandidates userId={userId} query={term} />
            {hasMore ? (
              <Link href={`/songs?q=${encodeURIComponent(term)}`} className="mt-3 inline-flex min-h-11 items-center text-sm text-fg underline">
                {t("Home.searchViewAll")}
              </Link>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

/** 헤더 자리는 바뀌지 않으므로 구독할 것이 없다 */
function subscribeNothing(): () => void {
  return () => {};
}

function findSlot(): HTMLElement | null {
  return document.getElementById(HEADER_HOME_SEARCH_SLOT_ID);
}
