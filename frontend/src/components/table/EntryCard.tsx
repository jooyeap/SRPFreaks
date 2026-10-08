import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { tableDetailHref } from "@/components/song/TableContext";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";

/**
 * 서열표 한 줄 (모바일). 재킷 칸을 숨기면서 4열 카드 격자 대신 한 줄 행으로 바꿨다.
 * 왼쪽: 곡명, 그 아래 `Guitar | MAS 9.80` 알약 + 달성 단계 + 속성. 오른쪽: 달성률, 추천, 기록 입력 버튼(+).
 * 기록이 있으면 data-stage를 붙여 왼쪽 4px 막대와 배경 틴트, 곡명·달성률 색을 같은 단계 색으로 맞춘다 (데스크톱 표의 EntryRow와 같은 규칙).
 */
export function EntryCard({ entry, onRecord }: { entry: TableEntryResponse; onRecord?: (entry: TableEntryResponse) => void }) {
  const stage = entry.mine?.stage ?? null;
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex items-center gap-2 border-t border-row-line py-2 pl-4 pr-3 first:border-t-0 md:hidden ${
        stage ? "stage-tint" : ""
      }`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1">
        <Link
          href={tableDetailHref(entry)}
          className={`block truncate text-sm hover:underline ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {entry.title}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
          {stage ? <StageBadge stage={stage} /> : null}
          <span className="text-xs text-fg-dim">속성 {entry.pattern ?? EMPTY_MARK}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`font-num text-sm font-semibold ${stage ? "stage-text" : "text-fg-faint"}`}>
          {formatRate(entry.mine?.rate)}
        </span>
        <RecommendBadge value={entry.recommend} />
      </div>
      {onRecord ? (
        <button
          type="button"
          onClick={() => onRecord(entry)}
          aria-label={`${entry.title} 기록 입력`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-chip-line text-base leading-none text-fg hover:bg-table-head"
        >
          +
        </button>
      ) : null}
    </li>
  );
}
