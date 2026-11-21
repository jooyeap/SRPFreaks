import type { ReactNode } from "react";
import { difficultyLabel, partLabel } from "@/lib/format";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/**
 * 알림 줄·묶음 상세가 함께 쓰는 작은 칩들(D86). 색은 CSS 변수(Tailwind 테마)만 쓰고, 뜻은 글자로도 전한다.
 */

/** `Bass MAS` 한 칩. 색은 data-difficulty에 따라 globals.css(.diff-chip)가 정한다. */
export function ChartChip({ part, difficulty }: { part: InstrumentPart; difficulty: DifficultyType }) {
  return (
    <span
      data-difficulty={difficulty}
      className="diff-chip inline-block shrink-0 text-nowrap rounded px-1.5 py-px font-num text-[11px] font-bold leading-4"
    >
      {partLabel(part)} {difficultyLabel(difficulty)}
    </span>
  );
}

/**
 * `상대 94.65` 같은 점수 칩. 앞 글자(라벨)는 흐리게, 값은 굵게. strong이면 값을 진하게 보인다.
 * 라벨에 닉네임이 들어갈 수 있어 한 줄로 고정하지 않고(nowrap 없음) 긴 글자는 칩 안에서 줄바꿈한다. 짧은 값만 담는 난이도·차이 칩은 줄바꿈하지 않는다.
 */
export function ScoreChip({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-baseline gap-1 rounded border border-chip-line px-1.5 font-num text-[11px] leading-5 text-fg-dim [overflow-wrap:anywhere]">
      {label}{" "}
      <b className={strong ? "text-fg" : "text-fg-sub"}>{value}</b>
    </span>
  );
}

/** 글자만 있는 칩(`기준 5.4 → 5.5` 같은 값). 점수 칩과 같은 테두리·크기. */
export function TextChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-baseline gap-1 rounded border border-chip-line px-1.5 font-num text-[11px] leading-5 text-fg-sub [overflow-wrap:anywhere]">
      {children}
    </span>
  );
}

/** 차이 칩(`−0.35`, `+16.00`). 부호가 글자로 보이므로 색만으로 앞뒤를 구분하지 않는다. */
export function DiffChip({ text, sign, prefix }: { text: string; sign: "up" | "down" | "even"; prefix?: ReactNode }) {
  const tone = sign === "up" ? "text-done-text" : sign === "down" ? "text-danger" : "text-fg-sub";
  return (
    <span className={`inline-flex shrink-0 items-baseline gap-1 text-nowrap rounded border border-chip-line px-1.5 font-num text-[11px] font-bold leading-5 ${tone}`}>
      {prefix}
      {text}
    </span>
  );
}
