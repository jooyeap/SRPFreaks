import type { AchievementStage } from "@/lib/types";

/**
 * 달성 단계 표시. 색만으로 구분하지 않도록 항상 글자(C/B/A/S/SS/FC/EXC)를 같이 쓴다 (DESIGN-UI 1장).
 * 모양은 시안대로 테두리 + 단계 색 글자(채우지 않음)다. 색은 data-stage에 따라 globals.css가 정한다. 컴포넌트에는 색 값이 없다.
 */
export function StageBadge({ stage }: { stage: AchievementStage }) {
  return (
    <span
      data-stage={stage}
      aria-label={`달성 단계 ${stage}`}
      className="stage-chip inline-block rounded-lg border border-chip-line px-2 font-num text-xs font-bold leading-5"
    >
      {stage}
    </span>
  );
}
