/**
 * 달성 단계 비율 막대: 전체 채보 중 EXC / FC / SS / S / S 미만이 각각 얼마인지 칸 너비로 보여 준다.
 * 왼쪽부터 높은 단계 순이고, 남은 부분(기록 없음)은 바탕색이다. 칸 색은 data-stage가 정하고(globals.css),
 * 컴포넌트에는 색 값이 없다. 막대는 장식이라 aria-hidden이고, 같은 숫자가 글자로 따로 있다(색만으로 전달하지 않는다).
 */
export interface StageCounts {
  exc: number;
  fc: number;
  ss: number;
  s: number;
  belowS: number;
}

const SEGMENTS = [
  { stage: "EXC", pick: (c: StageCounts) => c.exc },
  { stage: "FC", pick: (c: StageCounts) => c.fc },
  { stage: "SS", pick: (c: StageCounts) => c.ss },
  { stage: "S", pick: (c: StageCounts) => c.s },
  // S 미만(A/B/C 합)은 회색 계열인 A 색을 쓴다
  { stage: "A", pick: (c: StageCounts) => c.belowS },
] as const;

export function StageBar({ counts, total, className, done }: { counts: StageCounts; total: number; className: string; done?: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-stage-bar=""
      className={`flex overflow-hidden rounded-full bg-table-head ${done ? "ring-1 ring-done" : ""} ${className}`}
    >
      {total > 0
        ? SEGMENTS.map(({ stage, pick }) => {
            const count = pick(counts);
            return count > 0 ? (
              <span key={stage} data-stage={stage} className="stage-bar h-full" style={{ width: `${(count / total) * 100}%` }} />
            ) : null;
          })
        : null}
    </div>
  );
}
