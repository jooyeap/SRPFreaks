"use client";

import { useSearchPlaceholder } from "@/lib/search-placeholder";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchFocusButton } from "@/components/SearchFocusButton";
import { SongRequestLink } from "@/components/songs/SongRequestLink";
import { SongSuggestions } from "@/components/songs/SongSuggestions";
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
import { useTranslations } from "next-intl";

const DEBOUNCE_MS = 300;

/** 검색 입력칸의 id. 좌측 하단 고정 버튼(SearchFocusButton)이 이 칸으로 포커스를 옮긴다. */
export const TABLE_SEARCH_INPUT_ID = "table-search-input";

/**
 * 서열표 곡 찾기 (서열표·난이도 묶음 화면). 화면 위쪽의 검색창과 그 아래 결과 목록이고, 좌측 하단 고정 버튼은 이 검색창으로 포커스를 옮긴다.
 * (2026-10-25: 예전에는 고정 버튼이 팝업 창을 열었다. 길게 내려와도 바로 검색하고, 검색창이 화면에 있을 때도 바로 쓰도록 둘 다 둔다.)
 *
 * 서열표는 묶음·페이지로 나뉘어 있어 원하는 곡을 눈으로 찾기 어렵다. 검색은 곡 목록의 검색(곡명·아티스트·한글/일본어/로마자 표기·별칭)을
 * 그대로 쓰고, 이미 받아 둔 서열표 전체(groups)와 채보 id로 맞춰서 서열표에 있는 채보만 보여 준다.
 * 결과를 누르면 서열표 정보가 함께 나오는 곡 상세로 바로 간다.
 */
export function TableSearch({ userId, groups }: { userId: number; groups: readonly TierGroupResponse[] | undefined }) {
  const t = useTranslations();
  const placeholder = useSearchPlaceholder();
  const [text, setText] = useState("");
  const [query, setQuery] = useState(""); // 입력이 300ms 멈춘 뒤의 값. 이 값이 바뀔 때만 서버를 부른다

  useEffect(() => {
    const timer = setTimeout(() => setQuery(normalizeQuery(text)), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // userId: 로그아웃 후 다른 계정으로 들어왔을 때 이전 검색 결과(내 기록 포함)가 보이지 않게 쿼리 키에 넣는다
  const search = useQuery({
    queryKey: ["songs", "table-search", userId, query],
    queryFn: ({ signal }) => searchCharts(query, signal),
    enabled: query !== "",
  });

  const results = useMemo(
    () => (groups && search.data ? matchTableCharts(groups, search.data.content) : []),
    [groups, search.data],
  );
  const truncated = (search.data?.totalElements ?? 0) > SEARCH_PAGE_SIZE;

  return (
    <>
      <SearchFocusButton targetId={TABLE_SEARCH_INPUT_ID} />

      <section aria-label={t("Table.searchTitle")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-sm font-bold text-fg">{t("Table.searchTitle")}</h2>

        <input
          id={TABLE_SEARCH_INPUT_ID}
          type="search"
          value={text}
          maxLength={100}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          aria-label={t("Table.searchQueryAria")}
          className="min-h-12 w-full rounded-[10px] border border-ctl bg-page px-4 py-2 text-[15px] text-fg placeholder:text-fg-dim"
        />

        <div aria-live="polite" className="max-h-[60vh] overflow-y-auto">
          {query === "" ? (
            <p className="text-sm text-fg-sub">{t("Table.searchHint")}</p>
          ) : search.isPending ? (
            <p className="text-sm text-fg-sub">{t("Table.searching")}</p>
          ) : search.isError ? (
            <p role="alert" className="text-sm text-fg">
              {search.error instanceof ApiError ? search.error.message : t("Table.searchFailed")}
            </p>
          ) : results.length === 0 ? (
            <div>
              <p className="text-sm text-fg-sub">
                {t("Table.searchNone")}{" "}
                <Link href={`/songs?q=${encodeURIComponent(query)}`} className="underline">
                  {t("Table.searchInSongs")}
                </Link>
              </p>
              <SongSuggestions query={query} onPick={(title) => setText(title)} />
              <SongRequestLink query={query} />
            </div>
          ) : (
            <>
              <ul aria-label={t("Table.searchResults")} className="flex flex-col gap-2">
                {results.map(({ entry, tier }) => (
                  <li key={entry.songDifficultyId}>
                    <Link
                      href={tableSearchHref(entry)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-page px-3 py-2.5 hover:border-ctl"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-fg">{entry.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
                          <span className="text-xs text-fg-dim">
                            {t("Song.ratingConstant")} <span className="font-num">{formatTier(tier, t)}</span>
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
                <p className="mt-3 text-xs text-fg-dim">{t("Table.searchTooMany")}</p>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  );
}
