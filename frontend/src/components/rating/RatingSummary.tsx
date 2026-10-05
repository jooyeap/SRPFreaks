import { formatScore } from "@/lib/format";
import type { SkillResponse } from "@/lib/api-types";
import { tierProgress } from "@/lib/rating";

/**
 * 맨 위 레이팅 카드 (DESIGN-UI 5장): 합계, 단일/그 외 소계, 플레이어 티어 칩, 다음 티어까지 진행 막대와 남은 점수.
 * 마지막 티어는 `최고 티어`로 표시한다. 티어 이름은 글자로도 쓰므로 색만으로 구분하지 않는다.
 * Bronze 이상은 카드 테두리가 2px 그라데이션 + 글로우다 (globals.css의 .tier-card).
 */
export function RatingSummary({ skill }: { skill: SkillResponse }) {
  const progress = tierProgress(skill.totalScore, skill.tier);
  return (
    <section
      aria-label="내 레이팅"
      data-tier={skill.tier.key}
      className="tier-card flex flex-col gap-3 rounded-lg bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-fg-dim">레이팅 (SRN+)</p>
          <p className="font-num text-3xl font-semibold text-fg">{formatScore(skill.totalScore)}</p>
        </div>
        <span className="tier-chip rounded-full px-3 py-1 text-sm font-bold" aria-label={`플레이어 티어 ${skill.tier.displayName}`}>
          {skill.tier.displayName}
        </span>
      </div>

      <p className="flex flex-wrap gap-x-4 text-sm text-fg-sub">
        <span>
          단일 <span className="font-num text-fg">{formatScore(skill.singleScore)}</span>
        </span>
        <span>
          그 외 <span className="font-num text-fg">{formatScore(skill.otherScore)}</span>
        </span>
      </p>

      {progress ? (
        <div className="flex flex-col gap-1">
          <div
            role="progressbar"
            aria-label={`${progress.nextDisplayName}까지`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
            className="h-2 overflow-hidden rounded-full bg-table-head"
          >
            <div className="tier-bar h-full rounded-full" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
          <p className="text-xs text-fg-sub">
            {progress.nextDisplayName}까지 <span className="font-num text-fg">{formatScore(progress.remaining)}</span>
          </p>
        </div>
      ) : (
        <p className="text-sm font-semibold text-fg">최고 티어</p>
      )}
    </section>
  );
}

