"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pager } from "@/components/Pager";
import { SongSearchBox } from "@/components/songs/SongSearchBox";
import { useToast } from "@/components/Toast";
import { ChartBadge } from "@/components/table/Badges";
import { ApiError } from "@/lib/api";
import type { ChartRowResponse } from "@/lib/api-types";
import { addToSetlist, SETLIST_LIMIT, SETLIST_SEARCH_PAGE_SIZE, searchCharts, setlistKeys } from "@/lib/setlist";
import { useTranslations } from "next-intl";

/**
 * 세트리스트에 곡을 담는 검색 (D36). 곡명·아티스트로 채보를 찾고 줄마다 `담기`를 누른다.
 * 곡 목록·서열표·곡 상세에는 담기 버튼을 두지 않는다. 기록 입력 버튼과 헷갈리기 때문이다.
 * 검색은 곡 목록과 같은 API(GET /songs/charts)를 폴더 없이 쓴다. 이미 담은 채보는 `담김`으로 막아 두고, 30곡이 차면 모두 막는다.
 * addedIds: 지금 세트리스트에 담긴 채보 id들(서버가 중복·한도를 다시 검사한다).
 */
export function SetlistSearch({ userId, addedIds, full }: { userId: number; addedIds: ReadonlySet<number>; full: boolean }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [q, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const term = q.trim();

  const result = useQuery({
    queryKey: setlistKeys.search(userId, term, page),
    queryFn: ({ signal }) => searchCharts(term, page, signal),
    enabled: term !== "",
    placeholderData: keepPreviousData, // 쪽을 넘기는 동안 이전 결과를 그대로 보여 줘 화면이 깜빡이지 않는다
  });

  const add = useMutation({
    mutationFn: (chart: ChartRowResponse) => addToSetlist(chart.songDifficultyId),
    onSuccess: async () => {
      toast(t("Setlist.added"));
      await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    },
    // 30곡이 찼거나 이미 담긴 경우 등 서버가 거절한 문구를 그대로 보여 준다
    onError: (error) => toast(error instanceof ApiError ? error.message : t("Common.actionFailed")),
  });

  return (
    <section aria-label={t("Setlist.searchTitle")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-sm font-bold text-fg">{t("Setlist.searchTitle")}</h2>
      <div className="flex">
        <SongSearchBox
          value={q}
          onCommit={(next) => {
            setQuery(next);
            setPage(0); // 검색어가 바뀌면 1쪽부터
          }}
        />
      </div>
      {full ? <p className="text-xs text-fg-sub">{t("Setlist.limitFull", { limit: SETLIST_LIMIT })}</p> : null}

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
                    disabled={added || full || (add.isPending && add.variables?.songDifficultyId === chart.songDifficultyId)}
                    onClick={() => add.mutate(chart)}
                    aria-label={added ? t("Setlist.addedAria", { title: chart.title }) : t("Setlist.addAria", { title: chart.title })}
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
