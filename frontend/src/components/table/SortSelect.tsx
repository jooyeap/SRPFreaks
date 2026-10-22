import { SORT_OPTIONS, type TableSort } from "@/lib/table-sort";
import { useTranslations } from "next-intl";

/** 서열표 정렬 기준 선택. 묶음 안 채보의 순서만 바꾼다(묶음 순서는 그대로). */
export function SortSelect({ value, onChange }: { value: TableSort; onChange: (sort: TableSort) => void }) {
  const t = useTranslations();
  return (
    <label className="flex flex-wrap items-center gap-1.5 text-xs text-fg-dim">
      <span className="mr-1">{t("Table.sort")}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TableSort)}
        className="min-h-11 rounded-[10px] border border-chip-line bg-card px-3 py-1 text-sm text-fg"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
