import Link from "next/link";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import type { ChartRowResponse } from "@/lib/api-types";
import { songListDetailHref } from "@/lib/song-list";

/**
 * 곡 목록의 채보 한 줄 (모바일·데스크톱 공용, 폭에 따라 배치만 바뀐다).
 * 모바일: 곡명 / `Guitar | MAS 9.99` 알약 + 단계 + 버전. 데스크톱: 곡명 · 채보 알약 · 버전 · 달성률이 한 줄.
 * 전체 곡 목록에는 속성을 보이지 않는다 (DESIGN-UI 9장). 기록이 있으면 서열표와 같은 왼쪽 막대·배경 틴트를 준다.
 */
export function ChartRow({ row }: { row: ChartRowResponse }) {
  const stage = row.mine?.stage ?? null;
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex items-center gap-3 border-t border-row-line py-2 pl-4 pr-3 first:border-t-0 ${
        stage ? "stage-tint" : ""
      }`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1 md:flex md:items-center md:gap-3">
        <Link
          href={songListDetailHref(row)}
          className={`block truncate text-sm hover:underline md:flex-1 ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {row.title}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 md:mt-0 md:shrink-0">
          <ChartBadge part={row.part} difficulty={row.difficulty} level={row.level} />
          {stage ? <StageBadge stage={stage} /> : null}
          <span className="text-xs text-fg-dim md:w-20 md:truncate">{row.addedVersion ?? EMPTY_MARK}</span>
        </p>
      </div>
      <span className={`shrink-0 font-num text-sm font-semibold ${stage ? "stage-text" : "text-fg-faint"}`}>
        {formatRate(row.mine?.rate)}
      </span>
    </li>
  );
}
