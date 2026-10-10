import { chartTierAttrs, ratedScore } from "@/lib/chart-tier";
import { EMPTY_MARK, formatScore } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";

/**
 * 서열표 줄의 레이팅 점수 칸: 기록이 있으면 이 기록이 레이팅에 찍히는 점수를 플레이어 티어 색(상수표 칸과 같은 .chart-cell)으로 보인다.
 * 레이팅 대상이 아니면 `–`. 점수 숫자가 그대로 있으므로 색만으로 전달하지 않는다. 호출하는 쪽은 기록이 있을 때만 쓴다.
 */
export function RatedScore({ entry, tier }: { entry: TableEntryResponse; tier: number | null }) {
  const score = ratedScore(tier, entry.mine?.rate, entry);
  if (score === null) {
    return (
      <span aria-label="레이팅 점수 없음" className="font-num text-xs text-fg-faint">
        {EMPTY_MARK}
      </span>
    );
  }
  return (
    <span
      {...chartTierAttrs(score)}
      aria-label={`레이팅 점수 ${formatScore(score)}`}
      className="chart-cell inline-block rounded px-1.5 py-px font-num text-[11px] font-bold leading-4"
    >
      {formatScore(score)}
    </span>
  );
}
