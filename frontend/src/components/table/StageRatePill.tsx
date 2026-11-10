import type { AchievementStage } from "@/lib/types";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import { useTranslations } from "next-intl";

/**
 * `[S | 92.93]` 랭크·달성률 알약(서열표 모바일 줄, 곡 상세의 같은 난이도 곡). 폭 72px 고정(왼쪽 랭크 칸 28px).
 * 두 칸 모두 글자를 가운데 맞춘다(2026-11-01): 오른쪽 정렬이면 `MAX`처럼 짧은 값이 오른쪽으로 쏠리고,
 * 기록이 없을 때 `[– | –]`의 두 하이픈 위치가 어긋나 보였다. 두 칸 사이에는 얇은 구분선을 둔다.
 * 랭크 칸 색은 StageBadge와 같은 .stage-chip, 달성률 색은 .stage-text. 글자를 항상 적어 색만으로 전달하지 않는다.
 * `align="end"`(레이팅 카드만, 2026-11-02): 달성률을 오른쪽 끝에 맞추고 안쪽 여백을 4px로 둬서 위 점수 숫자(같은 4px 여백)와 오른쪽 끝이 한 선에 온다.
 * 숫자 폭은 tabular-nums로 고정한다. 기본(center)은 다른 화면 그대로다.
 */
export function StageRatePill({ stage, rate, align = "center" }: { stage: AchievementStage | null; rate: number | null | undefined; align?: "center" | "end" }) {
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
      <span className={`flex-1 bg-table-head text-xs tabular-nums ${align === "end" ? "pr-1 text-right" : "text-center"} ${stage ? "stage-text" : "text-fg-faint"}`}>
        {stage ? formatRate(rate) : EMPTY_MARK}
      </span>
    </span>
  );
}
