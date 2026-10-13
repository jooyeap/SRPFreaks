import { difficultyLabel, formatLevel, partLabel } from "@/lib/format";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/**
 * 파트 · 난이도 · 레벨을 한 알약으로 보여 준다 (예: `Guitar | MAS 9.80`).
 * 왼쪽 = 파트, 오른쪽 = 난이도 + 레벨. 색은 data-difficulty에 따라 globals.css(.chart-chip-*)가 정한다.
 * 파트 칸에 min-w를 둬서 Guitar/Bass가 섞인 목록에서도 오른쪽 칸의 시작 위치가 같다
 * (글자가 더 길면 넘치지 않고 칸이 늘어난다).
 * shrink-0: overflow-hidden 요소는 flex 안에서 줄어들 수 있어서, 좁은 칸에서 글자가 잘리지 않게 막는다.
 */
export function ChartBadge({
  part,
  difficulty,
  level,
}: {
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
}) {
  return (
    <span
      data-difficulty={difficulty}
      className="inline-flex shrink-0 overflow-hidden rounded align-middle font-num text-[11px] font-bold leading-4"
    >
      <span className="chart-chip-part min-w-[3.25rem] px-1.5 py-px text-center">{partLabel(part)}</span>
      <span className="chart-chip-diff whitespace-nowrap px-1.5 py-px">
        {difficultyLabel(difficulty)} {formatLevel(level)}
      </span>
    </span>
  );
}

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
 * 색만으로 구분하지 않는다. 색은 data-part에 따라 globals.css가 정한다.
 * 지금은 쓰는 곳이 없다: 파트·난이도·레벨은 ChartBadge 하나로 합쳤다. 파트만 따로 보여 줄 화면이 생기면 쓴다.
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
 * 추천도 배지. 상 = 주황 윤곽 + 연한 배경(채우지 않아 달성 단계 배지보다 튀지 않는다), 중 = 밝은 외곽선, 하 = 흐린 외곽선 (DESIGN-UI 3장).
 * 파랑/금색은 SS, EXC와 헷갈려서 쓰지 않는다. 값이 없으면 아무것도 그리지 않는다.
 * 값이 확정되지 않았더라도(API의 *Uncertain) `?`는 붙이지 않고 값만 보여 준다.
 */
export function RecommendBadge({ value }: { value: string | null }) {
  if (!value) {
    return null;
  }
  const style =
    value === "상"
      ? "border-[var(--rec-high-line)] bg-[var(--rec-high-tint)] text-[var(--rec-high-text)]"
      : value === "중"
        ? "border-[var(--rec-mid-line)] text-fg-sub"
        : "border-[var(--rec-low-line)] text-fg-faint";
  return (
    <span className={`inline-block rounded border px-1.5 py-px text-[11px] font-bold leading-4 ${style}`}>{value}</span>
  );
}
