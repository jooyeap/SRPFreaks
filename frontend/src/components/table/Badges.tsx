import { difficultyLabel, partLabel } from "@/lib/format";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/** 난이도 배지 (BAS/ADV/EXT/MAS). 색은 data-difficulty에 따라 globals.css가 정한다. */
export function DifficultyBadge({ difficulty }: { difficulty: DifficultyType }) {
  return (
    <span
      data-difficulty={difficulty}
      className="diff-chip inline-block rounded px-1.5 py-px font-num text-[11px] font-bold leading-4"
    >
      {difficultyLabel(difficulty)}
    </span>
  );
}

/**
 * 파트 배지 (Guitar / Bass). 파트마다 글자와 테두리 색이 다르지만 글자(Guitar/Bass)를 항상 같이 적어서
 * 색만으로 구분하지 않는다. 색은 data-part에 따라 globals.css가 정한다. 곡 상세, 서열표, 레이팅, 기록 시트에서 같은 모양으로 쓴다.
 */
export function PartBadge({ part }: { part: InstrumentPart }) {
  return (
    <span
      data-part={part}
      className="part-chip inline-block rounded border px-1.5 py-px text-[11px] font-bold leading-4"
    >
      {partLabel(part)}
    </span>
  );
}

/**
 * 추천도 배지. 상 = 주황 채움, 중 = 밝은 외곽선, 하 = 흐린 외곽선 (DESIGN-UI 3장).
 * 파랑/금색은 SS, EXC와 헷갈려서 쓰지 않는다. 값이 없으면 아무것도 그리지 않는다.
 * uncertain이면 값이 확정되지 않았다는 뜻으로 `?`를 붙인다.
 */
export function RecommendBadge({ value, uncertain }: { value: string | null; uncertain: boolean }) {
  if (!value) {
    return null;
  }
  const style =
    value === "상"
      ? "bg-[var(--rec-high-bg)] text-[var(--rec-high-fg)] border-transparent"
      : value === "중"
        ? "border-[var(--rec-mid-line)] text-fg-sub"
        : "border-[var(--rec-low-line)] text-fg-faint";
  return (
    <span
      title={uncertain ? "확정되지 않은 값" : undefined}
      className={`inline-block rounded border px-1.5 py-px text-[11px] font-bold leading-4 ${style}`}
    >
      {value}
      {uncertain ? "?" : ""}
    </span>
  );
}
