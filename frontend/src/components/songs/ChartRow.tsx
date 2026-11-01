import Link from "next/link";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { formatRate } from "@/lib/format";
import type { ChartRowResponse } from "@/lib/api-types";
import { songListDetailHref } from "@/lib/song-list";
import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";

/** 데스크톱 열: 곡명 · 랭크(달성 단계) · 채보 알약(파트·난이도·레벨) · 달성률. 모든 행이 같은 열 너비를 써서 줄마다 위치가 맞는다. 열 머리글(ChartList)도 같은 값을 쓴다. */
export const ROW_COLUMNS = "md:grid-cols-[minmax(0,1fr)_70px_190px_90px]";
const ROW_GRID = `md:grid ${ROW_COLUMNS} md:items-center md:gap-x-3`;

/**
 * 곡 목록의 채보 한 줄 (모바일·데스크톱 공용, 폭에 따라 배치만 바뀐다).
 * 모바일: 곡명 / `Guitar | MAS 9.99` 알약 + 랭크 (오른쪽에 달성률).
 * 데스크톱: 곡명 · 랭크 · 채보 · 달성률이 한 줄에 정렬된다. 버전은 행에 보이지 않고 필터로만 쓴다. 랭크(달성 단계 배지)는 곡명 오른쪽이다.
 * 랭크 칸은 기록이 없어도 자리를 비워 두므로(고정 폭) 랭크 유무와 상관없이 알약의 위치가 줄마다 같다.
 * 알약의 파트 칸은 최소 폭이 있어 Guitar/Bass가 섞여도 오른쪽 칸 시작 위치가 같다(ChartBadge).
 * href: 곡 상세 주소를 바꿀 때 쓴다(기본은 곡 목록에서 들어간 상세). 마이페이지 서열표 난이도 목록은 서열표 상세로 보낸다.
 * 전체 곡 목록에는 속성을 보이지 않는다 (DESIGN-UI 9장). 기록이 있으면 서열표와 같은 왼쪽 막대·배경 틴트를 준다.
 *
 * md:contents — 모바일의 묶음(div, p)을 데스크톱에서는 없는 것처럼 풀어서 자식들이 위 격자의 칸이 되게 한다.
 * 그러면 칸 순서가 DOM 순서(곡명, 알약, 랭크, 달성률)가 되므로 md:order-*로 데스크톱 순서만 따로 정한다.
 */
export function ChartRow({ row, href }: { row: ChartRowResponse; href?: string }) {
  const stage = row.mine?.stage ?? null;
  const jackets = useJackets();
  const jacketUrl = jackets.urlOf(row.songId);
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex min-h-14 items-center gap-3 border-t border-row-line py-2 ${jackets.visible ? "pl-3 md:pl-4" : "pl-4"} pr-3 first:border-t-0 md:min-h-12 ${ROW_GRID} ${
        stage ? "stage-tint" : ""
      }`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      {/* 재킷(D54): 모바일은 줄 가운데 44px 둥근 썸네일, 데스크톱은 곡명 앞 32px 칸 */}
      {jackets.visible ? <SongJacket url={jacketUrl} title={row.title} className="size-11 rounded-lg md:hidden" /> : null}
      <div className="min-w-0 flex-1 md:contents">
        <Link
          href={href ?? songListDetailHref(row)}
          className={`flex min-w-0 items-center gap-2 ${jackets.visible ? "text-[13px] md:text-sm" : "text-sm"} hover:underline md:order-1 ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {jackets.visible ? <SongJacket url={jacketUrl} title={row.title} className="hidden size-8 rounded md:block" /> : null}
          <span className="truncate">{row.title}</span>
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 md:contents">
          <span className="md:order-3">
            <ChartBadge part={row.part} difficulty={row.difficulty} level={row.level} />
          </span>
          <span className="inline-block w-9 md:order-2 md:w-auto">{stage ? <StageBadge stage={stage} /> : null}</span>
        </p>
      </div>
      <span className={`shrink-0 text-right font-num text-sm font-semibold md:order-4 md:text-base ${stage ? "stage-text" : "text-fg-faint"}`}>
        {formatRate(row.mine?.rate)}
      </span>
    </li>
  );
}
