import { chartTierAttrs, ratedScore } from "@/lib/chart-tier";
import { EMPTY_MARK, formatScore } from "@/lib/format";
import { HIT_CHIP } from "@/lib/hit-area";
import type { TableEntryResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/**
 * 서열표 줄의 레이팅 점수 칸: 기록이 있으면 이 기록이 레이팅에 찍히는 점수를 플레이어 티어 색(상수표 칸과 같은 .chart-cell)으로 보인다.
 * 레이팅 대상이 아니면 `–`. 점수 숫자가 그대로 있으므로 색만으로 전달하지 않는다. 호출하는 쪽은 기록이 있을 때만 쓴다.
 */
export function RatedScore({
  entry,
  tier,
  onRecord,
  smallDecimal = false,
}: {
  entry: TableEntryResponse;
  tier: number | null;
  /** 주면 점수 칩이 버튼이 되어 눌렀을 때 이 채보의 기록 창을 바로 연다(점수를 보다가 바로 고치려는 흐름) */
  onRecord?: (entry: TableEntryResponse) => void;
  /** 소수 부분(`.40`)을 작게 보인다(D64: 서열표 모바일 줄). 데스크톱 표는 그대로 */
  smallDecimal?: boolean;
}) {
  const t = useTranslations();
  const score = ratedScore(tier, entry.mine?.rate, entry);
  if (score === null) {
    return (
      <span aria-label={t("Table.noRatingScore")} className="font-num text-xs text-fg-faint">
        {EMPTY_MARK}
      </span>
    );
  }
  const chip = (
    <span
      {...chartTierAttrs(score)}
      aria-label={t("Chart.ratingScore", { score: formatScore(score) })}
      className="chart-cell inline-block rounded px-1.5 py-px font-num text-[11px] font-bold leading-4"
    >
      {smallDecimal ? <ScoreWithSmallDecimal text={formatScore(score)} /> : formatScore(score)}
    </span>
  );
  if (!onRecord) {
    return chip;
  }
  return (
    // 보이는 크기는 칩 그대로, ::after로 누를 수 있는 영역만 넓힌다(위아래 13px씩 → 44px, 좌우 6px. HIT_CHIP)
    <button
      type="button"
      onClick={() => onRecord(entry)}
      aria-label={t("Chart.recordEdit", { title: entry.title })}
      className={`inline-flex rounded hover:brightness-110 ${HIT_CHIP}`}
    >
      {chip}
    </button>
  );
}

/** `246.40` → `246` + 작은 `.40`. 보이는 점수 전체는 칩의 aria-label이 그대로 읽어 준다 */
function ScoreWithSmallDecimal({ text }: { text: string }) {
  const dot = text.indexOf(".");
  if (dot < 0) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, dot)}
      <span className="text-[9px]">{text.slice(dot)}</span>
    </>
  );
}
