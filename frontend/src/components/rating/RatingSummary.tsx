import Link from "next/link";
import { ChartBadge } from "@/components/table/Badges";
import { formatRate, formatScore } from "@/lib/format";
import type { SkillResponse } from "@/lib/api-types";
import { quickestRise, tierProgress } from "@/lib/rating";

/**
 * 맨 위 레이팅 카드 (DESIGN-UI 5장): 합계, 단일/복합·이중·삼중 소계, 플레이어 티어 칩, 다음 티어까지 진행 막대와 남은 점수.
 * 다음 티어까지 남은 점수 아래에 `가장 빨리 오르는 곡`(승급 예고, lib/rating.ts quickestRise) 한 줄이 붙는다.
 * 마지막 티어는 `최고 티어`로 표시한다. 티어 이름은 글자로도 쓰므로 색만으로 구분하지 않는다.
 * Bronze 이상은 카드 테두리가 2px 그라데이션 + 글로우다 (globals.css의 .tier-card).
 */
export function RatingSummary({ skill }: { skill: SkillResponse }) {
  const progress = tierProgress(skill.totalScore, skill.tier);
  const rise = quickestRise(skill);
  return (
    <section
      aria-label="내 레이팅"
      data-tier={skill.tier.key}
      className="tier-card flex flex-col gap-3 rounded-2xl bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-fg-dim">레이팅 (SRN+)</p>
          <p className="tier-score font-num text-3xl font-bold">{formatScore(skill.totalScore)}</p>
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
          {/* 승급 예고: 이미 목록에 있는 곡 중 95%까지 올리면 가장 많이 느는 곡 하나. 곡 이름은 글자로 보이고 점수 증가도 숫자로 적는다 */}
          {rise ? (
            <p aria-label="가장 빨리 오르는 곡" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-sub">
              <span>가장 빨리 오르는 곡</span>
              <Link
                href={`/songs/${rise.entry.songId}?from=table&chart=${rise.entry.songDifficultyId}`}
                className="font-semibold text-fg underline-offset-2 hover:underline"
              >
                {rise.entry.title}
              </Link>
              <ChartBadge part={rise.entry.part} difficulty={rise.entry.difficulty} level={rise.entry.level} />
              <span>
                {formatRate(rise.entry.achievementRate)}% → 95%까지 <span className="font-num text-fg">+{formatScore(rise.gain)}</span>
              </span>
              {rise.reachesNext ? <span className="font-semibold text-fg">이 곡만 올려도 {progress.nextDisplayName}에 도달합니다.</span> : null}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm font-semibold text-fg">최고 티어</p>
      )}
    </section>
  );
}

