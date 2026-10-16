import { chartTierAttrs, ratedScore } from "@/lib/chart-tier";
import { EMPTY_MARK, formatScore } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";

/**
 * 서열표 줄의 레이팅 점수 칸: 기록이 있으면 이 기록이 레이팅에 찍히는 점수를 플레이어 티어 색(상수표 칸과 같은 .chart-cell)으로 보인다.
 * 레이팅 대상이 아니면 `–`. 점수 숫자가 그대로 있으므로 색만으로 전달하지 않는다. 호출하는 쪽은 기록이 있을 때만 쓴다.
 */
export function RatedScore({
  entry,
  tier,
  onRecord,
}: {
  entry: TableEntryResponse;
  tier: number | null;
  /** 주면 점수 칩이 버튼이 되어 눌렀을 때 이 채보의 기록 창을 바로 연다(점수를 보다가 바로 고치려는 흐름) */
  onRecord?: (entry: TableEntryResponse) => void;
}) {
  const score = ratedScore(tier, entry.mine?.rate, entry);
  if (score === null) {
    return (
      <span aria-label="레이팅 점수 없음" className="font-num text-xs text-fg-faint">
        {EMPTY_MARK}
      </span>
    );
  }
  const chip = (
    <span
      {...chartTierAttrs(score)}
      aria-label={`레이팅 점수 ${formatScore(score)}`}
      className="chart-cell inline-block rounded px-1.5 py-px font-num text-[11px] font-bold leading-4"
    >
      {formatScore(score)}
    </span>
  );
  if (!onRecord) {
    return chip;
  }
  return (
    // 보이는 크기는 칩 그대로, ::after로 누를 수 있는 영역만 사방 6px 넓힌다(모바일에서 잘 눌리게)
    <button
      type="button"
      onClick={() => onRecord(entry)}
      aria-label={`${entry.title} 기록 수정`}
      className="relative inline-flex rounded after:absolute after:-inset-1.5 after:content-[''] hover:brightness-110"
    >
      {chip}
    </button>
  );
}
