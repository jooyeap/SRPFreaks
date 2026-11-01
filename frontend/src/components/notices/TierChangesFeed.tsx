"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import { tableDetailHref } from "@/components/song/TableContext";
import { ChartBadge } from "@/components/table/Badges";
import type { TierChangeResponse } from "@/lib/api-types";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";
import { EMPTY_MARK, formatPlayedDate, formatTier } from "@/lib/format";
import { patternChanged, tierChanged } from "@/lib/tier-history";
import { fetchTierChanges, recommendChanged, tierChangeKeys } from "@/lib/tier-changes";
import type { Translator } from "@/i18n/translator";

/** 한 줄이 말하는 변경 내용(예: `기준 난이도 5.6 → 5.7`, `추천 중 → 상`). 바뀐 항목만, 추가는 그때 정해진 값. */
function changeTexts(row: TierChangeResponse, t: Translator): string[] {
  const pattern = (value: string | null) => (value === null ? EMPTY_MARK : patternLabel(value, t));
  const recommend = (value: string | null) => (value === null ? EMPTY_MARK : recommendLabel(value, t));
  if (row.created) {
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

/** 최신순 목록을 서울 날짜별로 묶는다(같은 날 바뀐 것끼리 한 덩어리). 순서는 그대로 둔다. */
function groupByDate(rows: readonly TierChangeResponse[]): { date: string; rows: TierChangeResponse[] }[] {
  const groups: { date: string; rows: TierChangeResponse[] }[] = [];
  for (const row of rows) {
    const date = formatPlayedDate(row.changedAt);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.rows.push(row);
    } else {
      groups.push({ date, rows: [row] });
    }
  }
  return groups;
}

/**
 * 공지 화면의 `서열표 변경` 탭(D58). 운영자가 공지를 따로 쓰지 않아도 서열표의 기준 난이도·속성·추천이 바뀐 기록을
 * 날짜별로 자동으로 보여 준다(audit_logs, 바꾼 사람은 서버가 내려 주지 않는다). 로그인 없이 보인다(공개 읽기 경로).
 * 곡명을 누르면 서열표에서 들어간 곡 상세로 간다.
 */
export function TierChangesFeed() {
  const t = useTranslations();
  const feed = useInfiniteQuery({
    queryKey: tierChangeKeys.all,
    queryFn: ({ pageParam, signal }) => fetchTierChanges(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  });
  const rows = feed.data?.pages.flatMap((page) => page.content) ?? [];

  if (feed.isPending) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (feed.isError) {
    return (
      <ErrorRetry onRetry={() => void feed.refetch()} retrying={feed.isFetching}>
        {t("TierHistory.feedLoadFailed")}
      </ErrorRetry>
    );
  }
  if (rows.length === 0) {
    return <p className="text-sm text-fg-sub">{t("TierHistory.feedEmpty")}</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-fg-dim">{t("TierHistory.feedNote")}</p>
      {groupByDate(rows).map((group) => (
        <section key={group.date} aria-label={group.date} className="flex flex-col gap-2">
          <h2 className="px-1 font-num text-sm font-bold text-fg-sub">
            <time dateTime={group.rows[0].changedAt}>{group.date}</time>
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-line bg-card">
            {group.rows.map((row, index) => (
              <li key={`${row.changedAt}-${row.songDifficultyId}-${index}`} className="border-t border-row-line first:border-t-0">
                <Link href={tableDetailHref(row)} className="flex flex-col gap-1 px-4 py-2.5 hover:bg-table-head">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-fg">{row.title}</span>
                    {row.created ? (
                      <span className="shrink-0 rounded-md border border-chip-line px-1.5 text-[11px] text-fg-sub">{t("TierHistory.added")}</span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <ChartBadge part={row.part} difficulty={row.difficulty} level={row.level} />
                    <span className="text-xs text-fg">{changeTexts(row, t).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {feed.hasNextPage ? (
        <button
          type="button"
          onClick={() => void feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
          className="min-h-10 self-center rounded-lg border border-chip-line px-4 text-sm text-fg-sub enabled:hover:text-fg disabled:text-disabled"
        >
          {feed.isFetchingNextPage ? t("TierHistory.loadingMore") : t("TierHistory.loadMore")}
        </button>
      ) : null}
    </div>
  );
}
