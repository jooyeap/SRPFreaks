import Link from "next/link";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { formatRate } from "@/lib/format";
import type { ChartRowResponse } from "@/lib/api-types";
import { songListDetailHref } from "@/lib/song-list";

/** 데스크톱 열: 곡명 · 랭크(달성 단계) · 채보 알약(파트·난이도·레벨) · 달성률. 모든 행이 같은 열 너비를 써서 줄마다 위치가 맞는다. */
const ROW_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_40px_116px_56px] md:items-center md:gap-x-3";

/**
 * 곡 목록의 채보 한 줄 (모바일·데스크톱 공용, 폭에 따라 배치만 바뀐다).
 * 모바일: 곡명 / `Guitar | MAS 9.99` 알약 + 랭크 (오른쪽에 달성률).
 * 데스크톱: 곡명 · 랭크 · 채보 · 달성률이 한 줄에 정렬된다. 버전은 행에 보이지 않고 필터로만 쓴다. 랭크(달성 단계 배지)는 곡명 오른쪽이다.
 * 랭크 칸은 기록이 없어도 자리를 비워 두므로(고정 폭) 랭크 유무와 상관없이 알약의 위치가 줄마다 같다.
 * 알약의 파트 칸은 최소 폭이 있어 Guitar/Bass가 섞여도 오른쪽 칸 시작 위치가 같다(ChartBadge).
 * 전체 곡 목록에는 속성을 보이지 않는다 (DESIGN-UI 9장). 기록이 있으면 서열표와 같은 왼쪽 막대·배경 틴트를 준다.
 *
 * md:contents — 모바일의 묶음(div, p)을 데스크톱에서는 없는 것처럼 풀어서 자식들이 위 격자의 칸이 되게 한다.
 * 그러면 칸 순서가 DOM 순서(곡명, 알약, 랭크, 달성률)가 되므로 md:order-*로 데스크톱 순서만 따로 정한다.
 */
export function ChartRow({ row }: { row: ChartRowResponse }) {
  const stage = row.mine?.stage ?? null;
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex items-center gap-3 border-t border-row-line py-2 pl-4 pr-3 first:border-t-0 ${ROW_GRID} ${
        stage ? "stage-tint" : ""
      }`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1 md:contents">
        <Link
          href={songListDetailHref(row)}
          className={`block truncate text-sm hover:underline md:order-1 ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {row.title}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 md:contents">
          <span className="md:order-3">
            <ChartBadge part={row.part} difficulty={row.difficulty} level={row.level} />
          </span>
          <span className="inline-block w-9 md:order-2 md:w-auto">{stage ? <StageBadge stage={stage} /> : null}</span>
        </p>
      </div>
      <span className={`shrink-0 text-right font-num text-sm font-semibold md:order-4 ${stage ? "stage-text" : "text-fg-faint"}`}>
        {formatRate(row.mine?.rate)}
      </span>
    </li>
  );
}
