"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import { fetchChartCandidates, songListDetailHref } from "@/lib/song-list";
import { useTranslations } from "next-intl";

/**
 * 곡 목록 검색창 아래의 바로가기 후보. 검색어에 맞는 채보를 몇 개 보여 주고, 누르면 곡 상세로 바로 간다
 * (폴더를 하나씩 펼쳐서 찾지 않아도 된다). 아래 폴더 목록은 같은 검색어로 그대로 걸러지므로 이 목록은 지름길이다.
 * 검색어가 없거나 맞는 채보가 없으면 아무것도 그리지 않는다(없을 때의 안내는 폴더 목록 쪽이 한다).
 * userId: 결과에 내 기록이 섞여 있어서 쿼리 키에 넣는다(계정이 바뀌어도 이전 계정의 기록이 보이지 않게).
 */
export function SongJumpCandidates({ userId, query, className = "" }: { userId: number; query: string; className?: string }) {
  const t = useTranslations();
  const q = query.trim();
  const result = useQuery({
    queryKey: ["song-list", "candidates", userId, q],
    queryFn: ({ signal }) => fetchChartCandidates(q, signal),
    enabled: q !== "",
  });
  const rows = result.data?.content ?? [];
  if (q === "" || rows.length === 0) {
    return null;
  }
  return (
    <ul aria-label={t("Table.searchResults")} className={`flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 ${className}`}>
      {rows.map((row) => (
        <li key={row.songDifficultyId}>
          <Link
            href={songListDetailHref(row)}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-page px-3 py-2.5 hover:border-chip-line"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg">{row.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <ChartBadge part={row.part} difficulty={row.difficulty} level={row.level} />
              </span>
            </span>
            <span className="shrink-0 text-right">
              {row.mine ? (
                <>
                  <StageBadge stage={row.mine.stage} />
                  <span className="mt-0.5 block font-num text-xs text-fg-sub">{formatRate(row.mine.rate)}</span>
                </>
              ) : (
                <span className="text-xs text-fg-faint">{EMPTY_MARK}</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
