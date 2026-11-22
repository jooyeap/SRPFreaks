"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { ErrorRetry } from "@/components/ErrorRetry";
import { SongJumpCandidates } from "@/components/songs/SongJumpCandidates";
import { SongSearchBox } from "@/components/songs/SongSearchBox";
import { SongSuggestions } from "@/components/songs/SongSuggestions";
import { CANDIDATES_SIZE, fetchChartCandidates } from "@/lib/song-list";
import { useExitPresence } from "@/lib/use-exit-presence";
import { useHistoryClose } from "@/lib/use-history-close";

/** 오버레이 안 검색 입력칸의 id. 열리면 여기로 포커스를 준다 */
export const GLOBAL_SEARCH_INPUT_ID = "global-song-search-input";

/**
 * 헤더의 곡 검색 진입점과 검색 오버레이. 모든 화면(로그인 전 포함)에서 같은 자리(알림 종 왼쪽)에 있다 (D107, D100을 모든 화면으로 넓힘).
 *
 * 왜 오버레이인가(D100): 검색 한 번에 화면을 떠났다가 돌아오면 스크롤·탭 상태가 사라진다. 오버레이는 지금 화면 위에서 입력하고,
 * 결과를 누르면 곡 상세로 가며, 닫으면 있던 화면이 그대로 남는다. 검색 로직은 곡 목록의 부품을 그대로 쓴다:
 * SongSearchBox(300ms 디바운스) · SongJumpCandidates(GET /songs/charts, 8건, 누르면 곡 상세) · SongSuggestions(오타·가타카나 보정 추천어).
 *
 * 헤더 안에 직접 그린다(예전에는 화면마다 포털로 헤더 빈 자리에 끼워 넣었다). 헤더는 서버 컴포넌트이고 이 파일만 클라이언트라서,
 * 화면 쪽 코드가 없어도 모든 화면에 같은 모양이 나온다. 버튼은 하나이고 폭에 따라 모양만 바뀐다:
 * lg 미만은 44px 돋보기 아이콘, lg 이상은 검색창처럼 보이는 폭 260px 버튼(안내 글자 포함). 진짜 입력칸이 아니라 누르면 같은 오버레이가 열린다.
 *
 * 열고 닫는 동작은 기존 창(ConfirmDialog·RecordDialog)과 같다. 브라우저 <dialog>(showModal)가 포커스 가두기·Esc·바깥 배경 비활성화를,
 * useHistoryClose가 휴대폰 뒤로 가기로 창만 닫기를, useExitPresence가 닫힘 모션을 맡는다. <dialog>는 top layer라 하단 탭바 위에 뜬다.
 * 닫히면 포커스는 누른 버튼으로 돌아간다(키보드 사용자가 있던 자리로 복귀).
 *
 * 헤더는 화면을 옮겨도 사라지지 않으므로, 주소(pathname)가 바뀌면 열린 창을 닫는다. 예전에는 홈 화면이 사라지면서 같이 닫혔다.
 * 오버레이 안의 링크를 누르면 창을 바로 닫는다(같은 화면의 `/songs?q=`로 가는 링크는 pathname이 안 바뀌기 때문).
 *
 * 로그인 여부: 곡 검색 API(/songs/charts, /songs/suggest)는 비로그인 공개 읽기(D43)라서 로그인 전에도 같은 동작이다.
 * userId는 결과에 섞이는 "내 기록"의 캐시 키로만 쓰며 비로그인·확인 중은 0이다(서버가 mine을 주지 않는다).
 */
export function GlobalSongSearch() {
  const t = useTranslations();
  const { user } = useAuth();
  const pathname = usePathname();
  // "어느 주소에서 열었는가"를 저장한다. 주소가 바뀌면 값이 달라져 열림이 자동으로 풀린다(effect 안 setState 없이 닫기)
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = (restoreFocus: boolean) => {
    setOpenedAt(null);
    if (restoreFocus) {
      // 닫힘 모션 동안에도 버튼은 그대로 있으므로 바로 포커스를 돌려준다
      triggerRef.current?.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpenedAt(pathname)}
        aria-label={t("Songs.searchAria")}
        title={t("Songs.searchAria")}
        aria-haspopup="dialog"
        data-global-search=""
        // lg 미만: 터치 영역 44px 돋보기(음수 여백으로 헤더 높이는 늘리지 않는다). lg 이상: 검색창처럼 보이는 260px 버튼
        className="-my-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg hover:bg-table-head lg:my-0 lg:h-10 lg:w-[260px] lg:min-w-11 lg:shrink lg:justify-start lg:gap-2 lg:border lg:border-ctl lg:px-3"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden min-w-0 truncate text-sm text-fg-sub lg:inline">{t("Songs.searchPlaceholderShort")}</span>
      </button>
      <SearchOverlay open={open} userId={user?.id ?? 0} onClose={() => close(true)} onNavigate={() => close(false)} />
    </>
  );
}

function SearchOverlay({ open, userId, onClose, onNavigate }: { open: boolean; userId: number; onClose: () => void; onNavigate: () => void }) {
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
    document.getElementById(GLOBAL_SEARCH_INPUT_ID)?.focus();
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
      // whitespace-normal: 헤더(whitespace-nowrap) 안에 그려지므로 글자 줄바꿈 규칙을 물려받지 않게 되돌린다(안 그러면 안내 문장이 한 줄로 이어져 잘린다)
      // 큰 화면(md 이상)은 위쪽 가운데의 패널, 모바일은 전체 화면. 바깥(::backdrop) 클릭은 dialog 자신이 target이 된다
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
          return;
        }
        // 안쪽 링크(결과·모두 보기)를 누르면 이동하면서 닫는다. 포커스는 이동한 화면이 정하므로 버튼으로 돌리지 않는다
        if (event.target instanceof Element && event.target.closest("a")) {
          onNavigate();
        }
      }}
      className="fixed inset-0 m-0 flex h-full whitespace-normal max-h-none w-full max-w-none flex-col bg-page p-0 text-fg backdrop:bg-black/60 md:inset-x-0 md:bottom-auto md:top-[8vh] md:mx-auto md:h-auto md:max-h-[84vh] md:max-w-xl md:rounded-2xl md:border md:border-line md:bg-card"
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
        <SongSearchBox id={GLOBAL_SEARCH_INPUT_ID} value={q} onCommit={setQ} />
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
