"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import type { TierHistoryResponse } from "@/lib/api-types";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";
import { difficultyLabel, EMPTY_MARK, formatPlayedDate, formatTier, partLabel } from "@/lib/format";
import { fetchTierHistory, patternChanged, recommendChanged, tierChanged, tierHistoryKeys } from "@/lib/tier-history";
import type { Translator } from "@/i18n/translator";

/** 한 줄이 말하는 변경 내용(예: `기준 난이도 9.5 → 9.6`, `속성 단일 → 복합`). 바뀐 항목만 나온다. */
function changeTexts(row: TierHistoryResponse, t: Translator): string[] {
  const pattern = (value: string | null) => (value === null ? EMPTY_MARK : patternLabel(value, t));
  const recommend = (value: string | null) => (value === null ? EMPTY_MARK : recommendLabel(value, t));
  if (row.created) {
    // 서열표에 새로 올라온 줄: 그때 정해진 값을 보여 준다
    return [
      t("TierHistory.tierValue", { value: formatTier(row.afterTier, t) }),
      t("TierHistory.patternValue", { value: pattern(row.afterPattern) }),
      t("TierHistory.recommendValue", { value: recommend(row.afterRecommend) }),
    ];
  }
  const texts: string[] = [];
  if (tierChanged(row)) {
    texts.push(t("TierHistory.tierChange", { from: formatTier(row.beforeTier, t), to: formatTier(row.afterTier, t) }));
  }
  if (patternChanged(row)) {
    texts.push(t("TierHistory.patternChange", { from: pattern(row.beforePattern), to: pattern(row.afterPattern) }));
  }
  if (recommendChanged(row)) {
    texts.push(t("TierHistory.recommendChange", { from: recommend(row.beforeRecommend), to: recommend(row.afterRecommend) }));
  }
  return texts;
}

/**
 * 곡 상세 맨 아래의 "서열표 변경 이력" (D45). 서열표의 기준 난이도·속성·추천(2026-11-01부터)을 운영자가 고친 기록을 최신순으로 보여 준다.
 * 누가 바꿨는지는 서버가 내려 주지 않는다. 로그인 없이 보이는 화면이라 비로그인 방문자도 부른다(공개 읽기 경로).
 * 이력을 못 받아도 곡 상세의 나머지는 그대로 쓸 수 있도록 이 구역 안에서만 오류를 보여 준다.
 */
export function TierHistorySection({ songId }: { songId: number }) {
  const t = useTranslations();
  const history = useInfiniteQuery({
    queryKey: tierHistoryKeys.song(songId),
    queryFn: ({ pageParam, signal }) => fetchTierHistory(songId, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  });
  const rows = history.data?.pages.flatMap((page) => page.content) ?? [];

  return (
    <section aria-label={t("TierHistory.title")} className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
      <h2 className="text-sm font-semibold text-fg-sub">{t("TierHistory.title")}</h2>
      {history.isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : history.isError ? (
        <ErrorRetry onRetry={() => void history.refetch()} retrying={history.isFetching}>
          {t("TierHistory.loadFailed")}
        </ErrorRetry>
      ) : rows.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("TierHistory.empty")}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row, index) => (
              <li key={`${row.changedAt}-${row.songDifficultyId}-${index}`} className="flex flex-col gap-1 py-2 text-sm first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-fg-sub">
                  <time dateTime={row.changedAt} className="font-num">
                    {formatPlayedDate(row.changedAt)}
                  </time>
                  <span>
                    {partLabel(row.part)} {difficultyLabel(row.difficulty)}
                  </span>
                  {row.created ? <span className="rounded-md border border-chip-line px-1.5">{t("TierHistory.added")}</span> : null}
                </div>
                <p className="text-fg">{changeTexts(row, t).join(" · ")}</p>
              </li>
            ))}
          </ul>
          {history.hasNextPage ? (
            <button
              type="button"
              onClick={() => void history.fetchNextPage()}
              disabled={history.isFetchingNextPage}
              className="min-h-9 self-start rounded-lg border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg disabled:opacity-60"
            >
              {history.isFetchingNextPage ? t("TierHistory.loadingMore") : t("TierHistory.loadMore")}
            </button>
          ) : null}
          <p className="text-xs text-fg-sub">{t("TierHistory.note")}</p>
        </>
      )}
    </section>
  );
}
