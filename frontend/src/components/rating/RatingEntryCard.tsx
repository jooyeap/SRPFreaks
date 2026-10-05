import { DifficultyBadge, PartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { EMPTY_MARK, formatRate, formatScore, formatTier } from "@/lib/format";
import type { SkillEntryResponse } from "@/lib/api-types";

/**
 * 레이팅 목록의 곡 카드 (DESIGN-UI 5장): 재킷 칸(56px) · 곡명 · 기준 난이도·상수·속성 · 난이도 배지 + 파트 + 달성 단계 · 오른쪽에 점수와 달성률.
 * 모든 채보는 기록이 있으므로 단계가 항상 있다. FC/EXC는 왼쪽 4px 띠와 배경 틴트를 단계 색으로 준다 (서열표 카드와 같은 규칙).
 */
export function RatingEntryCard({ entry }: { entry: SkillEntryResponse }) {
  const accent = entry.stage === "FC" || entry.stage === "EXC";
  return (
    <li
      data-stage={entry.stage}
      className={`relative flex items-center gap-3 overflow-hidden rounded-lg border border-line bg-card py-2 pl-4 pr-3 ${
        accent ? "stage-tint" : ""
      }`}
    >
      {accent ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      <span className="w-6 shrink-0 text-center font-num text-xs text-fg-dim" aria-label={`${entry.rank}위`}>
        {entry.rank}
      </span>
      <span className="h-14 w-14 shrink-0 rounded bg-jacket" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${entry.stage === "EXC" || entry.stage === "FC" ? "stage-name" : "text-fg"}`}>
          {entry.title}
        </p>
        <p className="mt-0.5 text-xs text-fg-dim">
          기준 <span className="font-num">{formatTier(entry.tier)}</span> · 상수{" "}
          <span className="font-num">{formatScore(entry.ratingConstant)}</span> · {entry.pattern ?? EMPTY_MARK}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={entry.difficulty} />
          <PartBadge part={entry.part} />
          <StageBadge stage={entry.stage} />
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-num text-lg font-semibold text-fg">{formatScore(entry.score)}</p>
        <p className="stage-text font-num text-xs">{formatRate(entry.achievementRate)}</p>
      </div>
    </li>
  );
}
