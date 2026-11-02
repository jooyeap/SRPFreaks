"use client";

import Link from "next/link";
import { StageBadge } from "@/components/table/StageBadge";
import { chartTierAttrs, previewScore } from "@/lib/chart-tier";
import { formatRate, formatScore } from "@/lib/format";
import { ratingChangeText, type RatingChange } from "@/lib/records";
import { achievementStage, isHigherStage } from "@/lib/stage";
import { useTranslations } from "next-intl";

/**
 * 저장 직후 결과. 폼이 저장 응답과 저장 전 값(수정일 때만)을 모아 만든다.
 * 단계·곡 점수·티어 색은 저장하지 않고 이 값들로 화면에서 계산한다(서버와 같은 식, lib/chart-tier.ts).
 */
export interface SaveOutcome {
  /** 수정 전 달성률/풀콤보. 새 기록 등록이면 null (이전 기록을 이 폼은 모른다) */
  before: { rate: number; fullCombo: boolean } | null;
  after: { rate: number; fullCombo: boolean };
  /** 채보의 레이팅 상수 난이도. 없으면(미정) 곡 점수 줄을 그리지 않는다 */
  tier: number | null;
  ratingChange: RatingChange | null;
}

const ROW = "flex min-h-11 items-center justify-between gap-3 border-b border-row-line last:border-b-0";

export function SaveResultCard({ outcome, onClose }: { outcome: SaveOutcome; onClose: () => void }) {
  const t = useTranslations();
  const { before, after, tier, ratingChange } = outcome;
  const beforeStage = before ? achievementStage(before.rate, before.fullCombo) : null;
  const afterStage = achievementStage(after.rate, after.fullCombo);
  const stageUp = beforeStage && afterStage && isHigherStage(afterStage, beforeStage);

  const afterScore = tier === null ? null : previewScore(tier, after.rate);
  const beforeScore = before && tier !== null ? previewScore(tier, before.rate) : null;
  const scoreDiff = afterScore !== null && beforeScore !== null ? afterScore - beforeScore : null;

  const total = ratingChange && ratingChange.inList ? ratingChange : null;
  const notice = ratingChangeText(ratingChange, t);

  return (
    <section aria-label={t("Record.resultAria")} role="group" className="flex flex-col gap-3 pt-2">
      <h2 className="text-base font-bold text-done-text">{t("Record.resultSaved")}</h2>
      <dl className="flex flex-col">
        <div className={ROW}>
          <dt className="text-[13px] text-fg-sub">{t("Songs.colRate")}</dt>
          <dd className="font-num text-[15px] font-bold text-fg">
            {before ? (
              <>
                <span className="font-medium text-fg-dim">{formatRate(before.rate)}</span> <span aria-hidden="true">→</span>{" "}
                <span className="sr-only">{t("Record.from")}</span>
              </>
            ) : null}
            {formatRate(after.rate)}
          </dd>
        </div>
        <div className={ROW}>
          <dt className="text-[13px] text-fg-sub">{t("Record.stageLabel")}</dt>
          <dd className="flex items-center gap-2 font-num text-sm font-bold">
            {beforeStage && beforeStage !== afterStage ? (
              <>
                <StageBadge stage={beforeStage} />
                <span aria-hidden="true" className="text-fg-dim">
                  →
                </span>
              </>
            ) : null}
            {afterStage ? <StageBadge stage={afterStage} /> : null}
            {stageUp ? <span className="rounded border border-chip-on-bg px-1.5 py-0.5 text-[11px] text-fg">{t("Record.stageUp")}</span> : null}
          </dd>
        </div>
        {afterScore !== null ? (
          <div className={ROW}>
            <dt className="text-[13px] text-fg-sub">{t("Record.songScore")}</dt>
            <dd className="flex items-baseline gap-1.5 font-num text-[15px] font-bold">
              {beforeScore !== null ? (
                <>
                  <span className="text-[13px] font-medium text-fg-dim">{formatScore(beforeScore)}</span>
                  <span aria-hidden="true" className="text-fg-dim">
                    →
                  </span>
                </>
              ) : null}
              <span className="tier-score" {...chartTierAttrs(afterScore)}>
                {formatScore(afterScore)}
              </span>
              {scoreDiff !== null && scoreDiff !== 0 ? (
                <span className="text-xs text-done-text">
                  {scoreDiff > 0 ? "+" : "-"}
                  {formatScore(Math.abs(scoreDiff))}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {total ? (
          <div className={ROW}>
            <dt className="text-[13px] text-fg-sub">{t("Record.ratingTotal")}</dt>
            <dd className="flex flex-col items-end gap-0.5 font-num">
              <span className="text-base font-bold text-fg">
                {total.change === 0 ? t("Record.noChange") : `${total.change > 0 ? "+" : "-"}${formatScore(Math.abs(total.change))}`}
              </span>
              <span className="text-xs text-fg-dim">
                {formatScore(total.totalBefore)} <span aria-hidden="true">→</span>{" "}
                <span className="tier-score font-bold" {...chartTierAttrs(total.totalAfter)}>
                  {formatScore(total.totalAfter)}
                </span>
              </span>
            </dd>
          </div>
        ) : null}
        {ratingChange ? (
          <div className={ROW}>
            <dt className="text-[13px] text-fg-sub">{t("Record.ratingList")}</dt>
            <dd className="flex items-center gap-2 text-[13px] font-bold text-fg">
              {ratingChange.entered ? (
                <span className="rounded bg-chip-on-bg px-1.5 py-0.5 font-num text-[11px] text-chip-on-fg">NEW</span>
              ) : null}
              {ratingChange.entered ? t("Record.entered") : ratingChange.inList ? t("Record.inList") : t("Record.notInList")}
            </dd>
          </div>
        ) : null}
      </dl>
      {notice && !ratingChange?.inList ? <p className="text-xs text-fg-dim">{notice}</p> : null}
      <div className="flex gap-2">
        <Link href="/me?tab=rating" onClick={onClose} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-ctl text-sm text-fg">
          {t("Record.viewRating")}
        </Link>
        <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl bg-chip-on-bg text-sm font-bold text-chip-on-fg">
          {t("Record.nextSong")}
        </button>
      </div>
    </section>
  );
}
