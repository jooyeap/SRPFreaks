import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { SongJacket } from "@/components/SongJacket";
import { tableDetailHref } from "@/components/song/TableContext";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";

/** 표형 열 너비. 머리 행(TableHeadRow)과 같은 값을 써서 열이 맞는다. 채보 열(116px)은 파트·난이도·레벨 알약 하나다. */
export const ROW_GRID =
  "md:grid md:grid-cols-[4px_40px_minmax(0,1fr)_116px_64px_44px_52px_72px_48px] md:items-center md:gap-x-3";

/** 데스크톱 표의 머리 행 (모바일에서는 보이지 않는다). */
export function TableHeadRow() {
  return (
    <div className={`hidden bg-table-head px-3 py-2 text-xs text-fg-dim ${ROW_GRID}`} aria-hidden="true">
      <span />
      <span />
      <span>곡명</span>
      <span>채보</span>
      <span>달성률</span>
      <span>추천</span>
      <span>속성</span>
      <span>버전</span>
      <span />
    </div>
  );
}

/**
 * 서열표 한 줄 (데스크톱 표형).
 * 기록이 있으면 data-stage를 붙여서 왼쪽 4px 막대, 행 배경 틴트, 곡명 옆 단계 표시, 달성률 숫자 색을 같은 단계 색으로 맞춘다.
 * 기록이 없으면 data-stage가 없으므로 단계 색이 하나도 적용되지 않는다 (달성률 `–`).
 */
export function EntryRow({ entry, onRecord }: { entry: TableEntryResponse; onRecord?: (entry: TableEntryResponse) => void }) {
  const stage = entry.mine?.stage ?? null;
  return (
    <li
      data-stage={stage ?? undefined}
      className={`hidden border-t border-row-line px-3 py-2 text-sm md:grid ${ROW_GRID} ${stage ? "stage-tint" : ""}`}
    >
      <span className={`h-8 w-1 rounded ${stage ? "stage-bar" : "bg-transparent"}`} aria-hidden="true" />
      <SongJacket className="h-10 w-10 rounded-lg" />
      <span className="flex min-w-0 items-center gap-2">
        <Link
          href={tableDetailHref(entry)}
          className={`truncate hover:underline ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {entry.title}
        </Link>
        {stage ? <StageBadge stage={stage} /> : null}
      </span>
      <span>
        <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
      </span>
      <span className={`font-num font-semibold ${stage ? "stage-text" : "text-fg-faint"}`}>
        {formatRate(entry.mine?.rate)}
      </span>
      <span>
        <RecommendBadge value={entry.recommend} uncertain={entry.recommendUncertain} />
      </span>
      <span className="text-fg-sub" title={entry.patternUncertain ? "확정되지 않은 값" : undefined}>
        {entry.pattern ? `${entry.pattern}${entry.patternUncertain ? "?" : ""}` : EMPTY_MARK}
      </span>
      <span className="truncate text-fg-dim">{entry.addedVersion ?? EMPTY_MARK}</span>
      <span>
        {onRecord ? (
          <button
            type="button"
            onClick={() => onRecord(entry)}
            aria-label={`${entry.title} 기록 입력`}
            className="rounded-full border border-chip-line px-2.5 py-0.5 text-xs text-fg-sub hover:text-fg"
          >
            기록
          </button>
        ) : null}
      </span>
    </li>
  );
}
