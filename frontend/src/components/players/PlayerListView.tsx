"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PlayerRow } from "@/components/players/PlayerRow";
import { ApiError } from "@/lib/api";
import { fetchPlayers, PLAYERS_PAGE_SIZE, playerKeys } from "@/lib/players";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";

/**
 * 유저 목록 (D26). 본인이 공개를 켠 유저의 닉네임·플레이어 티어·총점만 보이고, 누르면 읽기 전용 상세로 간다.
 * 순위와 총점은 서버가 계산한 값을 그대로 보여 준다(화면에서 다시 계산하지 않는다).
 */
export function PlayerListView({ viewerId }: { viewerId: number }) {
  const t = useTranslations();
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page); // 다음·이전 페이지를 누르면 화면을 맨 위로 올린다
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: playerKeys.list(viewerId, page, PLAYERS_PAGE_SIZE),
    queryFn: ({ signal }) => fetchPlayers(page, PLAYERS_PAGE_SIZE, signal),
    placeholderData: keepPreviousData, // 페이지를 넘기는 동안 이전 화면을 유지한다 (깜빡임 방지)
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-fg">{t("Players.listTitle")}</h1>
        <p className="mt-1 text-sm text-fg-sub">
          {t.rich("Players.listLead", {
            l: (c) => (
              <Link href="/settings" className="underline">
                {c}
              </Link>
            ),
          })}
        </p>
      </div>

      {isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : isError ? (
        <ErrorRetry onRetry={() => void refetch()} retrying={isFetching}>
          {error instanceof ApiError ? error.message : t("Players.listFailed")}
        </ErrorRetry>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Players.listEmpty")}</p>
      ) : (
        <>
          <ul aria-label={t("Players.listTitle")} className="overflow-hidden rounded-2xl border border-line bg-card">
            {data.content.map((player) => (
              <PlayerRow key={player.userId} player={player} viewerId={viewerId} />
            ))}
          </ul>
          <nav aria-label={t("Common.pageNav")} className="flex items-center justify-center gap-3 text-sm text-fg-sub">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              className="rounded-lg border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              {t("Common.prev")}
            </button>
            <span className="font-num">
              {data.page + 1} / {Math.max(data.totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={page + 1 >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
            >
              {t("Common.next")}
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
