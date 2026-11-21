"use client";

import Link from "next/link";
import { patternLabel } from "@/lib/chart-labels";
import type { GridPattern } from "@/lib/pattern-grid";
import { patternGridReturnHref } from "@/lib/table-view-state";
import { useTranslations } from "next-intl";

/**
 * 속성별 화면의 칸을 눌러 폴더에 들어왔을 때 폴더 머리 아래에 나오는 띠(D93, 시안 Tier31).
 * `속성: 복합 ✕` 칩(누르면 그 속성 필터만 풀린다), `필터 초기화`(걸린 필터를 모두 푼다), 안내 한 줄, `속성별로 돌아가기` 링크.
 * 필터는 이 폴더 화면에만 적용되고 다른 폴더로 옮기면 풀린다(폴더 이동은 화면을 새로 만든다, page.tsx의 key). 반 높이 시트는 쓰지 않는다.
 * 칩을 풀거나 초기화한 뒤에는 안내(자동으로 걸렸다는 말)를 숨기고 돌아가기 링크만 남긴다.
 */
export function PatternFromGridBar({
  pattern,
  active,
  hasAnyFilter,
  onClearPattern,
  onReset,
}: {
  /** 주소로 들어온 속성(칸의 열) */
  pattern: GridPattern;
  /** 지금도 그 속성 필터가 걸려 있는가 (사용자가 풀었으면 false) */
  active: boolean;
  /** 속성 말고도 걸린 필터가 있는가(추천 등) — 초기화 버튼을 보일지 */
  hasAnyFilter: boolean;
  onClearPattern: () => void;
  onReset: () => void;
}) {
  const t = useTranslations();
  const label = patternLabel(pattern, t);
  return (
    <div data-testid="pattern-from-grid" className="flex flex-col gap-2 rounded-xl border border-dashed border-chip-line p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-chip-line bg-chip px-3 text-sm text-fg">
            {t("Table.patternFilterChip", { pattern: label })}
            <button
              type="button"
              aria-label={t("Table.patternFilterRemove", { pattern: label })}
              onClick={onClearPattern}
              className="-mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-fg-sub hover:text-fg"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </span>
        ) : null}
        {hasAnyFilter ? (
          <button type="button" onClick={onReset} className="min-h-8 rounded-full border border-ctl px-3 text-sm text-fg-sub hover:bg-table-head hover:text-fg">
            {t("Table.filterReset")}
          </button>
        ) : null}
        <Link href={patternGridReturnHref()} className="ml-auto min-h-8 py-1 text-sm text-fg-sub underline underline-offset-2 hover:text-fg">
          {t("Table.backToGrid")}
        </Link>
      </div>
      {active ? <p className="break-keep text-xs leading-[17px] text-fg-sub">{t("Table.patternFromGridNote", { pattern: label })}</p> : null}
    </div>
  );
}
