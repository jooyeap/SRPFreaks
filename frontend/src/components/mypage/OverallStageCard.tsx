import { StageBadge } from "@/components/table/StageBadge";
import { StageBar } from "@/components/table/StageBar";
import type { OverallStages } from "@/lib/my-page";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * 전체 달성 현황: 전체 채보 중 내 기록이 EXC / FC / SS / S / S 미만으로 얼마나 있는지 한 줄 막대와 개수로 보여 준다.
 * 홈의 서열표 진행도와 같은 막대·색을 쓴다(색 값은 globals.css). 막대는 장식이고 같은 숫자가 글자로 있다.
 */
export function OverallStageCard({ stages }: { stages: OverallStages }) {
  const counts = [
    { stage: "EXC", count: stages.exc },
    { stage: "FC", count: stages.fc },
    { stage: "SS", count: stages.ss },
    { stage: "S", count: stages.s },
  ] as const;
  return (
    <section aria-label="전체 달성 현황" className="flex flex-col gap-3 rounded-[14px] border border-line bg-card p-4">
      <h2 className="font-num text-[17px] font-bold text-fg">전체 달성 현황</h2>
      <p className="text-sm text-fg-sub">
        기록 <span className="font-num font-semibold text-fg">{stages.recorded}</span>/{stages.total}
        <span className="ml-2 font-num text-xs text-fg-dim">{percent(stages.recorded, stages.total)}%</span>
      </p>
      <StageBar counts={stages} total={stages.total} className="h-2.5" />
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {counts.map((c) => (
          <li key={c.stage} className={c.count === 0 ? "opacity-60" : undefined}>
            {/* 단계 배지에는 글자가 같이 있어 색만으로 구분하지 않는다 */}
            <StageBadge stage={c.stage} /> <span className="font-num text-fg-sub">{c.count}</span>
          </li>
        ))}
        <li className="text-fg-dim">
          S 미만 <span className="font-num text-fg-sub">{stages.belowS}</span>
        </li>
      </ul>
    </section>
  );
}
