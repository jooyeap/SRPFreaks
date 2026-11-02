"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import { tableDetailHref } from "@/components/song/TableContext";
import { ChartBadge } from "@/components/table/Badges";
import type { TierChangeResponse } from "@/lib/api-types";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";
import { EMPTY_MARK, formatPlayedDate, formatTier } from "@/lib/format";
import {
  fetchTierChanges,
  markTierChangesSeen,
  mergeSameChart,
  tierChangeKeys,
  type MergedTierChange,
} from "@/lib/tier-changes";
import type { Translator } from "@/i18n/translator";

/**
 * 한 줄(같은 날 같은 채보를 묶은 것)이 말하는 변경 내용. 바뀐 항목만 흐름대로(`기준 난이도 5.1 → 5.2 → 5.1`),
 * 그날 추가된 채보는 모든 항목을 보여 준다(한 번도 안 바뀐 항목은 `속성 복합`처럼 값만).
 */
function changeTexts(item: MergedTierChange, t: Translator): string[] {
  const pattern = (value: string | null) =>
    value === null ? EMPTY_MARK : patternLabel(value, t);
  const recommend = (value: string | null) =>
    value === null ? EMPTY_MARK : recommendLabel(value, t);
  const tier = (value: number | null) => formatTier(value, t);
  // 흐름이 2개 이상이면 `전 → … → 후`, 그날 추가된 채보면 값만, 아니면(그날 안 바뀐 항목) 쓰지 않는다
  const describe = <T,>(chain: T[], label: (v: T) => string, value: (v: string) => string, change: (from: string, to: string) => string): string | null => {
    if (chain.length > 1) {
      return change(chain.slice(0, -1).map(label).join(" → "), label(chain[chain.length - 1]));
    }
    return item.created ? value(label(chain[0])) : null;
  };
  return [
    describe(item.tiers, tier, (v) => t("TierHistory.tierValue", { value: v }), (from, to) => t("TierHistory.tierChange", { from, to })),
    describe(item.patterns, pattern, (v) => t("TierHistory.patternValue", { value: v }), (from, to) => t("TierHistory.patternChange", { from, to })),
    describe(item.recommends, recommend, (v) => t("TierHistory.recommendValue", { value: v }), (from, to) => t("TierHistory.recommendChange", { from, to })),
  ].filter((text): text is string => text !== null);
}

/** 최신순 목록을 서울 날짜별로 묶는다(같은 날 바뀐 것끼리 한 덩어리). 순서는 그대로 둔다. */
function groupByDate(
  rows: readonly TierChangeResponse[],
): { date: string; rows: TierChangeResponse[] }[] {
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
    getNextPageParam: (last) =>
      last.page + 1 < last.totalPages ? last.page + 1 : undefined,
  });
  const rows = feed.data?.pages.flatMap((page) => page.content) ?? [];
  // 이 탭을 열면 "여기까지 확인함"을 이 기기에 남긴다 → 서열표 묶음의 `최근 변경` 칩이 사라진다
  useEffect(() => {
    if (feed.isSuccess) {
      markTierChangesSeen();
    }
  }, [feed.isSuccess]);

  if (feed.isPending) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (feed.isError) {
    return (
      <ErrorRetry
        onRetry={() => void feed.refetch()}
        retrying={feed.isFetching}
      >
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
        <section
          key={group.date}
          aria-label={group.date}
          className="flex flex-col gap-2"
        >
          <h2 className="px-1 font-num text-sm font-bold text-fg-sub">
            <time dateTime={group.rows[0].changedAt}>{group.date}</time>
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-line bg-card">
            {/* 같은 날 같은 채보가 여러 번 바뀌었으면 한 줄로 묶는다(2026-11-02) */}
            {mergeSameChart(group.rows).map((item) => {
              const row = item.latest;
              return (
                <li
                  key={`${group.date}-${row.songDifficultyId}`}
                  className="border-t border-row-line first:border-t-0"
                >
                  <Link
                    href={tableDetailHref(row)}
                    className="flex flex-col gap-1 px-4 py-2.5 hover:bg-table-head"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-fg">
                        {row.title}
                      </span>
                      {item.created ? (
                        <span className="shrink-0 rounded-md border border-ctl px-1.5 text-[11px] text-fg-sub">
                          {t("TierHistory.added")}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <ChartBadge
                        part={row.part}
                        difficulty={row.difficulty}
                        level={row.level}
                      />
                      <span className="text-xs text-fg">
                        {changeTexts(item, t).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {feed.hasNextPage ? (
        <button
          type="button"
          onClick={() => void feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
          className="min-h-10 self-center rounded-lg border border-ctl px-4 text-sm text-fg-sub enabled:hover:text-fg disabled:text-disabled"
        >
          {feed.isFetchingNextPage
            ? t("TierHistory.loadingMore")
            : t("TierHistory.loadMore")}
        </button>
      ) : null}
    </div>
  );
}
