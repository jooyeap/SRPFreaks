"use client";

import Link from "next/link";
import { useMemo } from "react";
import { StageBar } from "@/components/table/StageBar";
import { isDone } from "@/components/home/ProgressTiles";
import type { TierGroupResponse } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { folderHref, type TableFilters } from "@/lib/difficulty-table";
import { buildPatternGrid, GRID_PATTERNS, patternFolderHref, type GridCell } from "@/lib/pattern-grid";
import { lowestFullStage } from "@/lib/progress";
import { layoutTiles, type TileOrder } from "@/lib/table-tiles";
import { rememberTableReturn } from "@/lib/table-view-state";
import { useTranslations } from "next-intl";

/**
 * 서열표 `속성별` 화면(폴더 × 속성, D93, 시안 Tier35). 행 = 기준 난이도 폴더, 열 = 속성(단일/복합/이중/삼중, 머리에 채보 수).
 * 칸에는 `기록/전체`와 아래 3px 단계 분포 막대가 있고, 누르면 그 폴더 상세에 그 속성 필터가 걸린 채로 열린다(`?pattern=복합`).
 * - 기록이 없는 칸은 점선 칸(`기록 없음`), 채보가 없는 칸은 `–`(누를 수 없음).
 * - 칸의 모든 채보에 기록이 있고 S 이상이면(홈·폴더 타일과 같은 isDone·lowestFullStage) 우측 상단 ✓ 동그라미(가장 낮은 단계 색 배경) + 옅은 배경(--done-tint) + 단계 색 테두리·글자.
 *   ✓는 장식이고 읽는 글자(`모든 채보가 S 이상입니다.`)와 `n/n`이 같이 있어 색만으로 전달하지 않는다. S 미만이 섞이면 숫자만 완료 색.
 * - 내 평균 폴더는 행 이름 숫자를 굵고 크게만 한다(`내 평균` 글자는 쓰지 않는다. 읽는 글자만 있다).
 * 집계는 서열표 묶음 응답을 화면에서 다시 센 값이다(lib/pattern-grid.ts, 새 API 없음).
 */
export function PatternGridView({
  groups,
  filters,
  average,
  order,
  returnQuery,
}: {
  groups: readonly TierGroupResponse[];
  filters: TableFilters;
  average: number | null;
  order: TileOrder;
  /** 지금 서열표의 보기 상태 쿼리(viewStateToQuery). 폴더로 갈 때 기억해 `←`·`속성별로 돌아가기`가 같은 화면으로 돌아오게 한다 */
  returnQuery: string;
}) {
  const t = useTranslations("Table");
  const tRoot = useTranslations(); // patternLabel은 전체 문구 사전을 받는다
  const grid = useMemo(() => buildPatternGrid(groups, filters), [groups, filters]);
  const { ordered, averageTier } = useMemo(() => layoutTiles(grid.rows, average, order), [grid.rows, average, order]);

  return (
    <section aria-labelledby="pattern-grid-title" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="pattern-grid-title" className="text-base font-bold text-fg">
          {t("gridTitle")}
        </h2>
        <p className="break-keep text-right text-xs text-fg-dim">{t("gridHint")}</p>
      </div>
      <table className="w-full table-fixed border-separate [border-spacing:6px]">
        <colgroup>
          <col className="w-9" />
          {GRID_PATTERNS.map((p) => (
            <col key={p} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              {t("gridRowHeader")}
            </th>
            {GRID_PATTERNS.map((p) => (
              <th key={p} scope="col" className="pb-0.5 text-center text-xs font-semibold leading-tight text-fg-sub">
                {patternLabel(p, tRoot)}
                <span className="block font-num text-[10px] font-normal text-fg-dim">{grid.columnTotals[p]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => {
            const isAverage = row.tier === averageTier;
            return (
              <tr key={row.tier} data-average={isAverage ? "true" : undefined}>
                <th scope="row" className={`text-center font-num leading-none ${isAverage ? "text-lg font-bold text-fg" : "text-sm font-semibold text-fg-sub"}`}>
                  {row.tier.toFixed(1)}
                  {isAverage ? <span className="sr-only"> {t("tilesMyAverage")}</span> : null}
                </th>
                {GRID_PATTERNS.map((p) => (
                  <td key={p} className="p-0 align-top">
                    <Cell cell={row.cells[p]} href={patternFolderHref(folderHref(row.tier), p)} label={t("gridCellLabel", { tier: row.tier.toFixed(1), pattern: patternLabel(p, tRoot) })} returnQuery={returnQuery} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function Cell({ cell, href, label, returnQuery }: { cell: GridCell; href: string; label: string; returnQuery: string }) {
  const t = useTranslations("Table");
  const p = useTranslations("Progress");
  if (cell.total === 0) {
    // 채보가 없는 칸: 누를 수 없는 `–`(읽는 글자는 `곡 없음`)
    return (
      <div className="flex min-h-11 items-center justify-center text-sm text-fg-faint">
        <span aria-hidden="true">–</span>
        <span className="sr-only">{label} {t("gridNoSongs")}</span>
      </div>
    );
  }
  const done = isDone(cell.recorded, cell.total);
  const stage = lowestFullStage(cell);
  return (
    <Link
      href={href}
      onClick={() => rememberTableReturn({ query: returnQuery, scrollY: window.scrollY, unfolded: false })}
      data-stage={stage ?? undefined}
      data-done={done ? "true" : undefined}
      // 완료 칸: 옅은 배경(--done-tint) + 단계 색 테두리. 칸 높이는 모두 같다(막대가 아래 가장자리를 차지한다)
      className={`relative flex min-h-11 flex-col items-center justify-center overflow-hidden rounded-lg border px-0.5 pb-[5px] pt-1 hover:opacity-90 ${
        stage
          ? "[background:linear-gradient(180deg,var(--done-tint),transparent_90%),var(--card)] [border-color:color-mix(in_srgb,var(--st-text)_50%,var(--line))]"
          : done
            ? "[background:linear-gradient(180deg,var(--done-tint),transparent_90%),var(--card)] border-line"
            : "bg-card border-line"
      } ${cell.recorded === 0 ? "border-dashed" : ""}`}
    >
      <span className="sr-only">{label} </span>
      {stage ? (
        <span
          aria-hidden="true"
          data-full-check=""
          className="stage-bar absolute right-[3px] top-[3px] flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold leading-none text-[color:var(--stage-chip-fg)]"
        >
          ✓
        </span>
      ) : null}
      <span className={`font-num text-[13px] font-bold leading-4 ${stage ? "stage-text" : done ? "text-done-text" : cell.recorded === 0 ? "text-fg-dim" : "text-fg"}`}>
        {cell.recorded}/{cell.total}
      </span>
      {cell.recorded === 0 ? <span className="text-[9px] leading-3 text-fg-dim">{t("gridNoRecord")}</span> : null}
      {stage ? <span className="sr-only"> {stage === "EXC" ? p("allExc") : p("allAtLeast", { stage })}</span> : null}
      {done ? <span className="sr-only"> {t("tilesDone")}</span> : null}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 block">
        <StageBar counts={cell} total={cell.total} className="h-[3px]" />
      </span>
    </Link>
  );
}
