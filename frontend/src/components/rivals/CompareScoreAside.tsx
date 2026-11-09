import { ScoreDiffChip } from "@/components/rivals/ScoreDiffChip";
import { chartTierAttrs } from "@/lib/chart-tier";
import { formatScore } from "@/lib/format";
import { useTranslations } from "next-intl";

/**
 * 라이벌 비교 줄의 오른쪽 열(D65): 위에서부터 상대 점수(티어 색, 소수는 작게) / `나 238.10`(내 점수) / 차이 칩(내 점수 - 상대 점수).
 * 레이팅 비교 목록과 대시보드의 속성별 곡 목록·미리보기가 같은 모양을 쓴다. 점수·차이는 서버가 계산한 값을 그대로 쓴다.
 */
export function CompareScoreAside({ score, myScore, diff }: { score: number; myScore: number | null; diff: number | null }) {
  const t = useTranslations("Rival");
  const [whole, decimal] = formatScore(score).split(".");
  return (
    <div className="flex w-[88px] shrink-0 flex-col items-end gap-0.5">
      <span {...chartTierAttrs(score)} className="tier-score font-num text-lg font-semibold leading-5 tabular-nums">
        {whole}
        <span className="text-[11px]">.{decimal}</span>
      </span>
      {myScore !== null ? <span className="font-num text-[11px] leading-4 text-fg-dim">{t("myScoreLine", { score: formatScore(myScore) })}</span> : null}
      <ScoreDiffChip diff={diff} />
    </div>
  );
}
