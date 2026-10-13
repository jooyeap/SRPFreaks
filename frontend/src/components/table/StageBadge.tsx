import type { AchievementStage } from "@/lib/types";

/**
 * 달성 단계 표시. 색만으로 구분하지 않도록 항상 글자(C/B/A/S/SS/FC/EXC)를 같이 쓴다 (DESIGN-UI 1장).
 * 색은 data-stage에 따라 globals.css가 정한다. 컴포넌트에는 색 값이 없다.
 */
export function StageBadge({ stage }: { stage: AchievementStage }) {
  return (
    <span
      data-stage={stage}
      aria-label={`달성 단계 ${stage}`}
      className="stage-chip inline-block rounded px-1.5 py-px font-num text-[11px] font-bold leading-4"
    >
      {stage}
    </span>
  );
}
