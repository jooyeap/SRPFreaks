"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChartBadge } from "@/components/table/Badges";
import { StageRatePill } from "@/components/table/StageRatePill";
import { patternLabel } from "@/lib/chart-labels";
import { formatTier } from "@/lib/format";
import { formatBpm } from "@/lib/songs";
import { fetchChartCandidates, songListDetailHref } from "@/lib/song-list";
import { useTranslations } from "next-intl";

/**
 * 곡 목록 검색창 아래의 바로가기 후보. 검색어에 맞는 채보를 몇 개 보여 주고, 누르면 곡 상세로 바로 간다
 * (폴더를 하나씩 펼쳐서 찾지 않아도 된다). 아래 폴더 목록은 같은 검색어로 그대로 걸러지므로 이 목록은 지름길이다.
 * 검색어가 없거나 맞는 채보가 없으면 아무것도 그리지 않는다(없을 때의 안내는 폴더 목록 쪽이 한다).
 * 줄 모양(D106, 카드 B): 윗줄 곡명 + 오른쪽 `[단계 | 달성률]`, 가운데 `아티스트 · BPM`, 아랫줄 채보 칩 + 서열표 난이도·속성·레이팅상수.
 * 서열표 값이 없는 채보(서열표에 없음·미정)는 그 칸만 빠지고 줄은 그대로다. 비어 있는 값을 하드코딩하지 않고 서버 값만 쓴다.
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
      {rows.map((row) => {
        const hasBpm = row.bpmMin != null || row.bpmMax != null;
        const sub = [row.artist ?? null, hasBpm ? `BPM ${formatBpm(row.bpmMin ?? null, row.bpmMax ?? null)}` : null].filter(
          (v): v is string => v !== null && v !== "",
        );
        return (
          <li key={row.songDifficultyId}>
            <Link
              href={songListDetailHref(row)}
              className="motion-press flex items-center justify-between gap-3 rounded-xl border border-line bg-page px-3 py-2.5 hover:border-ctl"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{row.title}</span>
                {sub.length > 0 && <span className="mt-0.5 block truncate text-xs text-fg-sub">{sub.join(" · ")}</span>}
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <ChartBadge part={row.part} difficulty={row.difficulty} level={row.level} />
                  {row.tier != null && <span className="font-num text-xs text-fg-sub">{t("Table.rowTier", { tier: formatTier(row.tier, t) })}</span>}
                  {row.patternType && <span className="text-xs text-fg-sub">{patternLabel(row.patternType, t)}</span>}
                  {row.ratingConstant != null && (
                    <span className="font-num text-xs text-fg-sub">{t("Table.rowConstant", { value: row.ratingConstant.toFixed(1) })}</span>
                  )}
                </span>
              </span>
              <StageRatePill stage={row.mine?.stage ?? null} rate={row.mine?.rate} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
