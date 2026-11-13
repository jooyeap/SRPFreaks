"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pager } from "@/components/Pager";
import { SongSearchBox } from "@/components/songs/SongSearchBox";
import { ChartBadge } from "@/components/table/Badges";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import type { ChartRowResponse } from "@/lib/api-types";
import { SETLIST_SEARCH_PAGE_SIZE, searchCharts } from "@/lib/setlist";
import { addToList, listKeys } from "@/lib/user-lists";

/**
 * 리스트 상세의 「+ 곡 추가」 검색: 곡명·아티스트로 채보를 찾아 줄마다 `담기`를 누르면 이 리스트에 바로 담긴다.
 * 검색 API는 세트리스트 검색과 같은 GET /songs/charts(곡 목록과 같은 규칙)를 그대로 쓴다. 이미 담긴 채보는 `담김`으로 막는다.
 * 서버는 이미 담긴 곡을 다시 담아도 오류로 보지 않으므로(alreadyContained) 그때는 안내만 한다. 곡 수 한도는 서버가 거절하고 그 문구를 그대로 보인다.
 */
export function ListSongSearch({ userId, listId, addedIds }: { userId: number; listId: number; addedIds: ReadonlySet<number> }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [q, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const term = q.trim();

  const result = useQuery({
    // 검색 결과에는 내 기록이 섞이므로 세트리스트 검색과 같이 사용자 id를 키에 넣는다
    queryKey: ["lists", "search", userId, term, page] as const,
    queryFn: ({ signal }) => searchCharts(term, page, signal),
    enabled: term !== "",
    placeholderData: keepPreviousData,
  });

  const add = useMutation({
    mutationFn: (chart: ChartRowResponse) => addToList(listId, chart.songDifficultyId),
    onSuccess: async (response) => {
      toast(t(response.alreadyContained ? "MyList.alreadyIn" : "MyList.added"), { kind: response.alreadyContained ? "info" : "success" });
      await queryClient.invalidateQueries({ queryKey: listKeys.all });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : t("Common.actionFailed"), { kind: "error" }),
  });

  return (
    <section aria-label={t("MyList.searchTitle")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <h3 className="text-sm font-bold text-fg">{t("MyList.searchTitle")}</h3>
      <div className="flex">
        <SongSearchBox
          value={q}
          onCommit={(next) => {
            setQuery(next);
            setPage(0);
          }}
        />
      </div>
      {term === "" ? null : result.isPending ? (
        <p className="text-sm text-fg-sub">{t("Setlist.searching")}</p>
      ) : result.isError ? (
        <p role="alert" className="text-sm text-fg">
          {result.error instanceof ApiError ? result.error.message : t("Setlist.searchFailed")}
        </p>
      ) : result.data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Setlist.noResults")}</p>
      ) : (
        <>
          <ul aria-label={t("Setlist.resultsAria")} className="flex flex-col">
            {result.data.content.slice(0, SETLIST_SEARCH_PAGE_SIZE).map((chart) => {
              const added = addedIds.has(chart.songDifficultyId);
              return (
                <li key={chart.songDifficultyId} className="flex items-center justify-between gap-3 border-t border-row-line py-2 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{chart.title}</p>
                    <p className="mt-1">
                      <ChartBadge part={chart.part} difficulty={chart.difficulty} level={chart.level} />
                    </p>
                  </div>
                  {/* 담김은 색이 아니라 글자와 체크 아이콘으로 구분한다 */}
                  <button
                    type="button"
                    disabled={added || (add.isPending && add.variables?.songDifficultyId === chart.songDifficultyId)}
                    onClick={() => add.mutate(chart)}
                    className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-ctl px-3 text-sm text-fg enabled:hover:bg-table-head disabled:text-disabled"
                  >
                    {added ? (
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    ) : null}
                    {added ? t("Setlist.addedMark") : t("Setlist.addBtn")}
                  </button>
                </li>
              );
            })}
          </ul>
          <Pager page={page} totalPages={result.data.totalPages} onChange={setPage} />
        </>
      )}
    </section>
  );
}
