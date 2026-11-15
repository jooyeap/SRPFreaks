"use client";

import { patternLabel } from "@/lib/chart-labels";
import { PROGRESS_PATTERNS, type PatternCounts, type ProgressPattern } from "@/lib/progress-pattern";
import { useTranslations } from "next-intl";

/**
 * 홈 진행도 카드의 속성 필터 칩(D85): 전체 / 단일 / 복합 / 이중 / 삼중. 칩마다 그 속성의 채보 수가 붙는다.
 * 하나만 고르는 버튼 묶음(aria-pressed)이고, 숫자는 글자로 같이 보여서 색만으로 선택 여부를 전달하지 않는다
 * (선택한 칩은 색과 함께 굵은 글자 + 테두리가 다르다). 시안 Home4처럼 어두운 판(둥근 14px) 안에 다섯 칸을 균등 분할해 360px에서도 한 줄에 들어가고
 * 글자는 위(이름) 아래(숫자) 두 줄이다. 높이는 44px(누르는 영역). 누름 모션은 기존 `motion-press`(움직임 줄이기에서는 CSS가 끈다).
 */
export function PatternChips({ value, counts, onChange }: { value: ProgressPattern; counts: PatternCounts; onChange: (pattern: ProgressPattern) => void }) {
  const t = useTranslations("Progress");
  const tRoot = useTranslations();
  return (
    <div role="group" aria-label={t("patternAria")} className="grid grid-cols-5 gap-0.5 rounded-[14px] border border-line bg-table-head p-[3px]">
      {PROGRESS_PATTERNS.map((pattern) => {
        const selected = pattern === value;
        return (
          <button
            key={pattern}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(pattern)}
            className={`motion-press flex min-h-11 min-w-0 flex-col items-center justify-center rounded-[11px] px-0.5 leading-tight ${
              selected ? "bg-chip-on-bg text-chip-on-fg" : "text-fg-sub hover:bg-card"
            }`}
          >
            <span className="max-w-full truncate text-xs font-bold">{pattern === "all" ? t("patternAll") : patternLabel(pattern, tRoot)}</span>
            {/* 읽는 이름이 `삼중0`으로 붙지 않게 공백을 둔다(flex 안이라 눈에는 영향 없다) */}
            {" "}
            <span className="font-num text-[9px] font-semibold">{counts[pattern]}</span>
          </button>
        );
      })}
    </div>
  );
}
