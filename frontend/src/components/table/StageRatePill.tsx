import type { AchievementStage } from "@/lib/types";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import { useTranslations } from "next-intl";

/**
 * `[S | 92.93]` 랭크·달성률 알약(서열표 모바일 줄, 곡 상세의 같은 난이도 곡). 폭 72px 고정(왼쪽 랭크 칸 28px).
 * 두 칸 모두 글자를 가운데 맞춘다(2026-11-01): 오른쪽 정렬이면 `MAX`처럼 짧은 값이 오른쪽으로 쏠리고,
 * 기록이 없을 때 `[– | –]`의 두 하이픈 위치가 어긋나 보였다. 두 칸 사이에는 얇은 구분선을 둔다.
 * 랭크 칸 색은 StageBadge와 같은 .stage-chip, 달성률 색은 .stage-text. 글자를 항상 적어 색만으로 전달하지 않는다.
 */
export function StageRatePill({ stage, rate }: { stage: AchievementStage | null; rate: number | null | undefined }) {
  const t = useTranslations();
  return (
    <span className="inline-flex w-[72px] shrink-0 overflow-hidden rounded font-num text-[11px] font-bold leading-[18px]">
      {stage ? (
        <span data-stage={stage} aria-label={t("Chart.stage", { stage })} className="stage-chip w-7 shrink-0 text-center">
          {stage}
        </span>
      ) : (
        <span className="w-7 shrink-0 bg-table-head text-center text-fg-faint">{EMPTY_MARK}</span>
      )}
      <span className="w-px shrink-0 bg-row-line" aria-hidden="true" />
      <span className={`flex-1 bg-table-head text-center text-xs ${stage ? "stage-text" : "text-fg-faint"}`}>
        {stage ? formatRate(rate) : EMPTY_MARK}
      </span>
    </span>
  );
}
