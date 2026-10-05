import { DifficultyBadge, RecommendBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { EMPTY_MARK, formatLevel, formatRate, partLabel } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";

/**
 * 서열표 한 칸 (모바일 카드형, 4열 격자의 한 칸).
 * 재킷 칸(단색): 왼쪽 위 레벨, 오른쪽 위 파트, 아래 난이도 색 띠. FC/EXC는 칸 테두리를 단계 색으로 둔다.
 * 그 아래: 곡명(2줄 말줄임), 달성률 + 추천, 단계 표시, 속성. 재킷 이미지는 쓰지 않는다 (DESIGN.md 15장).
 */
export function EntryCard({ entry }: { entry: TableEntryResponse }) {
  const stage = entry.mine?.stage ?? null;
  const ringed = stage === "FC" || stage === "EXC";
  return (
    <li data-stage={stage ?? undefined} className="flex min-w-0 flex-col gap-1 md:hidden">
      <div
        data-difficulty={entry.difficulty}
        className={`relative aspect-square overflow-hidden rounded bg-jacket ${ringed ? "stage-ring" : ""}`}
      >
        <span className="absolute left-1 top-1 rounded bg-page/70 px-1 font-num text-[10px] text-fg">
          {formatLevel(entry.level)}
        </span>
        <span className="absolute right-1 top-1 rounded bg-page/70 px-1 text-[10px] text-fg">{partLabel(entry.part)}</span>
        <span className="diff-band absolute inset-x-0 bottom-0 h-1" aria-hidden="true" />
      </div>
      <p className={`line-clamp-2 text-[11px] leading-tight ${ringed && stage === "EXC" ? "stage-name" : "text-fg"}`}>
        {entry.title}
      </p>
      <div className="flex items-center justify-between gap-1">
        <span className={`font-num text-xs font-semibold ${stage ? "stage-text" : "text-fg-faint"}`}>
          {formatRate(entry.mine?.rate)}
        </span>
        <RecommendBadge value={entry.recommend} uncertain={entry.recommendUncertain} />
      </div>
      <div className="flex items-center justify-between gap-1">
        {stage ? <StageBadge stage={stage} /> : <span />}
        <span className="flex items-center gap-1 text-[10px] text-fg-dim">
          <DifficultyBadge difficulty={entry.difficulty} />
          {entry.pattern ?? EMPTY_MARK}
        </span>
      </div>
    </li>
  );
}
