import { SORT_OPTIONS, type TableSort } from "@/lib/table-sort";

/** 서열표 정렬 기준 선택. 묶음 안 채보의 순서만 바꾼다(묶음 순서는 그대로). */
export function SortSelect({ value, onChange }: { value: TableSort; onChange: (sort: TableSort) => void }) {
  return (
    <label className="flex flex-wrap items-center gap-1.5 text-xs text-fg-dim">
      <span className="mr-1">정렬</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TableSort)}
        className="rounded-full border border-chip-line bg-card px-3 py-1 text-sm text-fg"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
