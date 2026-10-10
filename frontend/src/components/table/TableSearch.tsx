"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { ApiError } from "@/lib/api";
import type { TierGroupResponse } from "@/lib/api-types";
import { EMPTY_MARK, formatRate, formatTier } from "@/lib/format";
import {
  matchTableCharts,
  normalizeQuery,
  searchCharts,
  SEARCH_PAGE_SIZE,
  tableSearchHref,
} from "@/lib/table-search";

const DEBOUNCE_MS = 300;

/**
 * 서열표 곡 찾기. 화면 우측 하단에 떠 있는(fixed) 검색 버튼 하나와, 누르면 열리는 검색창이다 (서열표·난이도 묶음 화면에서만 쓴다).
 *
 * 서열표는 묶음·페이지로 나뉘어 있어 원하는 곡을 눈으로 찾기 어렵다. 검색은 곡 목록의 검색(곡명·아티스트·한글/일본어/로마자 표기·별칭)을
 * 그대로 쓰고, 이미 받아 둔 서열표 전체(groups)와 채보 id로 맞춰서 서열표에 있는 채보만 보여 준다.
 * 결과를 누르면 서열표 정보가 함께 나오는 곡 상세로 간다.
 *
 * 창은 브라우저 기본 <dialog>(showModal)로 만든다: 포커스 가두기, Esc로 닫기, 바깥 클릭 막기를 브라우저가 처리해 준다(RecordDialog와 같은 방식).
 */
export function TableSearch({ userId, groups }: { userId: number; groups: readonly TierGroupResponse[] | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [query, setQuery] = useState(""); // 입력이 300ms 멈춘 뒤의 값. 이 값이 바뀔 때만 서버를 부른다

  useEffect(() => {
    const timer = setTimeout(() => setQuery(normalizeQuery(text)), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      // 일부 환경(테스트용 가짜 브라우저)에는 showModal이 없어서 open 속성으로 대신한다
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  // userId: 로그아웃 후 다른 계정으로 들어왔을 때 이전 검색 결과(내 기록 포함)가 보이지 않게 쿼리 키에 넣는다
  const search = useQuery({
    queryKey: ["songs", "table-search", userId, query],
    queryFn: ({ signal }) => searchCharts(query, signal),
    enabled: open && query !== "",
  });

  const results = useMemo(
    () => (groups && search.data ? matchTableCharts(groups, search.data.content) : []),
    [groups, search.data],
  );
  const truncated = (search.data?.totalElements ?? 0) > SEARCH_PAGE_SIZE;

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="곡 검색"
        title="곡 검색"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-chip-on-bg text-chip-on-fg shadow-lg"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>

      <dialog
        ref={ref}
        aria-labelledby="table-search-title"
        // Esc(cancel 이벤트)와 닫힘(close 이벤트) 모두 부모 상태를 맞춘다
        onClose={close}
        // 창 바깥(::backdrop) 클릭은 dialog 자신이 target이 된다
        onClick={(event) => {
          if (event.target === ref.current) {
            close();
          }
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 h-[85vh] max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-card px-4 pb-5 pt-2.5 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:h-auto md:max-h-[80vh] md:max-w-lg md:rounded-xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="table-search-title" className="text-lg font-extrabold">
            서열표 곡 검색
          </h2>
          <button type="button" onClick={close} className="rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg">
            닫기
          </button>
        </div>

        <input
          type="search"
          value={text}
          maxLength={100}
          onChange={(event) => setText(event.target.value)}
          placeholder="곡명, 아티스트 검색 (한글·일본어·로마자)"
          aria-label="곡 검색어"
          className="mb-3 w-full rounded-full border border-chip-line bg-page px-4 py-2 text-sm text-fg placeholder:text-fg-dim"
        />

        <div aria-live="polite">
          {query === "" ? (
            <p className="text-sm text-fg-sub">곡명이나 아티스트를 입력하면 서열표에서 찾아 줍니다.</p>
          ) : search.isPending ? (
            <p className="text-sm text-fg-sub">검색 중입니다.</p>
          ) : search.isError ? (
            <p role="alert" className="text-sm text-fg">
              {search.error instanceof ApiError ? search.error.message : "검색하지 못했습니다. 잠시 후 다시 시도해 주세요."}
            </p>
          ) : results.length === 0 ? (
            <p className="text-sm text-fg-sub">
              서열표에서 찾지 못했습니다.{" "}
              <Link href={`/songs?q=${encodeURIComponent(query)}`} className="underline">
                곡 목록에서 검색
              </Link>
            </p>
          ) : (
            <>
              <ul aria-label="검색 결과" className="flex flex-col gap-2">
                {results.map(({ entry, tier }) => (
                  <li key={entry.songDifficultyId}>
                    <Link
                      href={tableSearchHref(entry)}
                      onClick={close}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-page px-3 py-2.5 hover:border-chip-line"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-fg">{entry.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
                          <span className="text-xs text-fg-dim">
                            레이팅 상수 난이도 <span className="font-num">{formatTier(tier)}</span>
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {entry.mine ? (
                          <>
                            <StageBadge stage={entry.mine.stage} />
                            <span className="mt-0.5 block font-num text-xs text-fg-sub">{formatRate(entry.mine.rate)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-fg-faint">{EMPTY_MARK}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {truncated ? (
                <p className="mt-3 text-xs text-fg-dim">결과가 많아 일부만 보입니다. 검색어를 더 자세히 입력해 주세요.</p>
              ) : null}
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
