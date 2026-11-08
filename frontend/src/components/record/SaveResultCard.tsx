"use client";

import { StageBadge } from "@/components/table/StageBadge";
import { chartTierAttrs, previewScore } from "@/lib/chart-tier";
import { formatRate, formatScore } from "@/lib/format";
import { notBestText, ratingChangeText, type RatingChange } from "@/lib/records";
import type { EntryGroup } from "@/lib/rating-preview";
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
  /**
   * 이 채보가 들어가는 그룹(단일 15 / 그 외 25). 속성과 설정 개수로 프론트가 정한다. 판정할 수 없으면 null이라 기존 문구를 쓴다.
   * 서버가 그룹(ratingChange.group)·곡 점수 전후·남은 점수·최고 기록 아님을 주면 그 값이 이긴다(2단계). 서버 값이 없을 때(구버전 응답)만 이 값과 화면 계산을 쓴다.
   */
  entry?: EntryGroup | null;
}

const ROW = "flex min-h-11 items-center justify-between gap-3 border-b border-row-line last:border-b-0";

/**
 * onNext: 세트리스트에서 입력 중일 때만 넘긴다. 있으면 `다음 곡 ›` 버튼이 보이고, 누르면 다음 곡 입력 창으로 바뀐다. 없으면 [닫기]만 보인다.
 */
export function SaveResultCard({ outcome, onClose, onNext }: { outcome: SaveOutcome; onClose: () => void; onNext?: () => void }) {
  const t = useTranslations();
  const { before, after, tier, ratingChange, entry } = outcome;
  // 서버가 레이팅 대상이 아닌 이유를 주면 그것이 이긴다. 없으면(구버전 응답) 기준 난이도 유무로 1단계처럼 판정한다.
  const reason = ratingChange?.notRatedReason ?? null;
  const excluded = reason === "EXCLUDED" || reason === "NOT_RATED"; // 속성 제외 등: 점수·목록 줄 대신 안내 한 줄
  const undecided = reason === "TIER_UNDECIDED" || (reason === null && tier === null); // 기준 난이도 미정: 같은 방식
  const notRated = undecided || excluded;
  const beforeStage = before ? achievementStage(before.rate, before.fullCombo) : null;
  const afterStage = achievementStage(after.rate, after.fullCombo);
  const stageUp = beforeStage && afterStage && isHigherStage(afterStage, beforeStage);

  // 곡 점수: 서버 값(scoreAfter)이 있으면 전/후 모두 서버 값(전이 null이면 처음 기록한 채보). 없으면 1단계의 화면 계산
  const serverScore = ratingChange?.scoreAfter !== undefined && ratingChange?.scoreAfter !== null;
  const afterScore = serverScore ? (ratingChange?.scoreAfter ?? null) : tier === null ? null : previewScore(tier, after.rate);
  const beforeScore = serverScore
    ? (ratingChange?.scoreBefore ?? null)
    : before && tier !== null
      ? previewScore(tier, before.rate)
      : null;
  const scoreDiff = afterScore !== null && beforeScore !== null ? Math.round((afterScore - beforeScore) * 100) / 100 : null;

  const total = ratingChange && ratingChange.inList ? ratingChange : null;
  const notice = ratingChangeText(ratingChange, t);
  const notBest = notBestText(ratingChange, after.rate, t); // 이전 최고 기록 이하라 레이팅 그대로 (서버 값이 있을 때만)
  // 서버가 그룹을 주면 진입 안내도 서버의 그룹·한도를 쓴다
  const entryGroup: EntryGroup | null =
    ratingChange?.group && ratingChange.groupLimit
      ? { group: ratingChange.group === "SINGLE" ? "single" : "other", limit: ratingChange.groupLimit }
      : (entry ?? null);
  const pointsToList = ratingChange && !ratingChange.inList ? (ratingChange.pointsToList ?? null) : null;
  const pointsText = pointsToList !== null && pointsToList > 0 ? t("Record.pointsToList", { points: formatScore(pointsToList) }) : null;

  return (
    <section aria-label={t("Record.resultAria")} role="group" className="flex flex-col gap-3 pt-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-done-text">
        <span aria-hidden="true">✓</span>
        {t("Record.resultSaved")}
      </h2>
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
        {ratingChange && !notRated ? (
          <div className={ROW}>
            <dt className="text-[13px] text-fg-sub">{t("Record.ratingList")}</dt>
            <dd className="flex items-center gap-2 text-[13px] font-bold text-fg">
              {ratingChange.entered ? (
                <span className="rounded bg-chip-on-bg px-1.5 py-0.5 font-num text-[11px] text-chip-on-fg">NEW</span>
              ) : null}
              {ratingChange.entered
                ? entryGroup
                  ? t(entryGroup.group === "single" ? "Record.enteredSingle" : "Record.enteredOther", { limit: entryGroup.limit })
                  : t("Record.entered")
                : ratingChange.inList ? t("Record.inList") : t("Record.notInList")}
            </dd>
          </div>
        ) : null}
      </dl>
      {undecided ? (
        <p className="text-xs text-fg-dim">{t("Record.tierUndecidedNote")}</p>
      ) : excluded ? (
        <p className="text-xs text-fg-dim">{t("Record.excludedNote")}</p>
      ) : (
        <>
          {/* 최고 기록 아님 안내가 있으면 `레이팅은 그대로입니다.` 계열 문구를 대신한다 */}
          {notBest ? <p className="text-xs text-fg-dim">{notBest}</p> : notice && !ratingChange?.inList ? <p className="text-xs text-fg-dim">{notice}</p> : null}
          {pointsText ? <p className="font-num text-xs text-fg-dim">{pointsText}</p> : null}
        </>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-ctl text-sm text-fg">
          {t("Common.close")}
        </button>
        {onNext ? (
          <button type="button" onClick={onNext} className="min-h-11 flex-1 rounded-xl bg-chip-on-bg text-sm font-bold text-chip-on-fg">
            {t("Record.nextSong")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
