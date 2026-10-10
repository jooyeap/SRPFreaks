import { formatScore } from "@/lib/format";
import type { SkillResponse } from "@/lib/api-types";
import { tierProgress } from "@/lib/rating";

/**
 * 맨 위 레이팅 카드 (DESIGN-UI 5장): 왼쪽에 티어 칸(위 = 티어 이름, 아래 = 합계 점수)을 반반 나눠 두고,
 * 오른쪽에 단일/복합·이중·삼중 소계와 다음 티어까지 진행 막대·남은 점수를 둔다. 마지막 티어는 `최고 티어`.
 * 티어 칸은 설명서 상수표의 칸(.chart-cell)과 같은 색·빛·검정 글자라서, 내 레이팅이 상수표의 어느 색 구간인지 바로 맞춰 볼 수 있다.
 * 티어 이름과 점수가 글자로 같이 있으므로 색만으로 구분하지 않는다.
 * Bronze 이상은 카드 테두리가 2px 그라데이션 + 글로우다 (globals.css의 .tier-card).
 */
export function RatingSummary({ skill }: { skill: SkillResponse }) {
  const progress = tierProgress(skill.totalScore, skill.tier);
  return (
    <section
      aria-label="내 레이팅"
      data-tier={skill.tier.key}
      className="tier-card flex items-stretch gap-4 rounded-[14px] bg-card p-4"
    >
      {/* 위아래 반반: 구분선은 반투명 검정이라 어떤 티어 색 위에서도 보인다 */}
      <div className="chart-cell flex w-32 shrink-0 flex-col overflow-hidden rounded-xl text-center">
        <p
          aria-label={`플레이어 티어 ${skill.tier.displayName}`}
          className="flex flex-1 items-center justify-center border-b border-black/25 px-2 py-2 text-sm font-bold"
        >
          {skill.tier.displayName}
        </p>
        <p className="flex flex-1 flex-col items-center justify-center px-2 py-2">
          <span className="text-[11px] leading-none opacity-80">레이팅 (SRN+)</span>
          <span className="font-num text-xl font-bold leading-tight">{formatScore(skill.totalScore)}</span>
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
        <p className="flex flex-col gap-0.5 text-sm text-fg-sub">
          <span>
            단일 <span className="font-num text-fg">{formatScore(skill.singleScore)}</span>
          </span>
          <span>
            복합·이중·삼중 <span className="font-num text-fg">{formatScore(skill.otherScore)}</span>
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
      </div>
    </section>
  );
}
