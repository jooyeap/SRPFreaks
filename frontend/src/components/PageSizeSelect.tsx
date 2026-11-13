"use client";

import { useTranslations } from "next-intl";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "@/lib/page-size";

/**
 * 목록 맨 위의 `10개씩` 선택. 고른 값은 usePageSize가 이 탭에 기억한다.
 * 값을 바꾸면 보던 쪽 번호가 어긋나므로 바꾼 쪽(onChange)에서 1쪽으로 돌아가야 한다.
 * 선택 상자는 높이 40px 이상(터치 영역 규칙, DESIGN-UI)으로 둔다.
 */
export function PageSizeSelect({
  value,
  onChange,
  options = DEFAULT_PAGE_SIZE_OPTIONS,
}: {
  value: number;
  onChange: (size: number) => void;
  options?: readonly number[];
}) {
  const t = useTranslations("Common");
  return (
    <select
      value={value}
      aria-label={t("pageSizeAria")}
      onChange={(e) => onChange(Number(e.target.value))}
      className="min-h-10 rounded-[10px] border border-ctl bg-card px-3 text-sm text-fg"
    >
      {options.map((n) => (
        <option key={n} value={n}>
          {t("pageSizeOption", { count: n })}
        </option>
      ))}
    </select>
  );
}
