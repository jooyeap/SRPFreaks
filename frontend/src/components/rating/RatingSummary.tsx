import { formatScore } from "@/lib/format";
import type { SkillResponse } from "@/lib/api-types";
import { tierProgress } from "@/lib/rating";
import { useTranslations } from "next-intl";

/**
 * 맨 위 레이팅 카드 (DESIGN-UI 5장): 합계, 단일/복합·이중·삼중 소계, 플레이어 티어 칩, 다음 티어까지 진행 막대와 남은 점수.
 * 마지막 티어는 `최고 티어`로 표시한다. 티어 이름은 글자로도 쓰므로 색만으로 구분하지 않는다.
 * Bronze 이상은 카드 테두리가 2px 그라데이션 + 글로우다 (globals.css의 .tier-card).
 */
export function RatingSummary({ skill }: { skill: SkillResponse }) {
  const t = useTranslations();
  const progress = tierProgress(skill.totalScore, skill.tier);
  return (
    <section
      aria-label={t("Rating.mine")}
      data-tier={skill.tier.key}
      className="tier-card flex flex-col gap-3 rounded-2xl bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-fg-dim">{t("Rating.summaryTitle")}</p>
          <p className="tier-score font-num text-3xl font-bold">{formatScore(skill.totalScore)}</p>
        </div>
        <span className="tier-chip rounded-full px-3 py-1 text-sm font-bold" aria-label={t("Rating.tierAria", { name: skill.tier.displayName })}>
          {skill.tier.displayName}
        </span>
      </div>

      <p className="flex flex-wrap gap-x-4 text-sm text-fg-sub">
        <span>
          {t.rich("Rating.labelSingle", { n: (c) => <span className="font-num text-fg">{c}</span>, score: formatScore(skill.singleScore) })}
        </span>
        <span>
          {t.rich("Rating.labelOther", { n: (c) => <span className="font-num text-fg">{c}</span>, score: formatScore(skill.otherScore) })}
        </span>
      </p>

      {progress ? (
        <div className="flex flex-col gap-1">
          <div
            role="progressbar"
            aria-label={t("Rating.untilAria", { name: progress.nextDisplayName })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
            className="h-2 overflow-hidden rounded-full bg-table-head"
          >
            <div className="tier-bar h-full rounded-full" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
          <p className="text-xs text-fg-sub">
            {t.rich("Rating.untilText", { n: (c) => <span className="font-num text-fg">{c}</span>, name: progress.nextDisplayName, score: formatScore(progress.remaining) })}
          </p>
        </div>
      ) : (
        <p className="text-sm font-semibold text-fg">{t("Rating.topTier")}</p>
      )}
    </section>
  );
}

