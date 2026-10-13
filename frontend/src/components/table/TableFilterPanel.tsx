import { FilterChips, MultiFilterChips, type ChipOption } from "@/components/table/FilterChips";
import { PATTERN_OPTIONS, RECOMMEND_OPTIONS, toggleValue, type TableFilters } from "@/lib/difficulty-table";
import type { InstrumentPart } from "@/lib/types";

export const PART_OPTIONS: readonly ChipOption<InstrumentPart>[] = [
  { value: "GUITAR", label: "Guitar" },
  { value: "BASS", label: "Bass" },
];
const RECOMMEND_CHIPS: readonly ChipOption<string>[] = RECOMMEND_OPTIONS.map((v) => ({ value: v, label: v }));
const PATTERN_CHIPS: readonly ChipOption<string>[] = PATTERN_OPTIONS.map((v) => ({ value: v, label: v }));

/**
 * 서열표 필터 칩 세 줄(파트 하나 / 추천 여러 개 / 속성 여러 개). 서열표 본문과 묶음 화면이 함께 쓴다.
 * 값을 직접 바꾸지 않고 바뀐 부분(patch)만 부모에게 알린다.
 */
export function TableFilterPanel({ filters, onChange }: { filters: TableFilters; onChange: (patch: Partial<TableFilters>) => void }) {
  return (
    <>
      <FilterChips label="파트" options={PART_OPTIONS} selected={filters.part} onChange={(part) => onChange({ part })} />
      <MultiFilterChips
        label="추천"
        options={RECOMMEND_CHIPS}
        selected={filters.recommend}
        onToggle={(value) => onChange({ recommend: toggleValue(filters.recommend, value, RECOMMEND_OPTIONS) })}
        onClear={() => onChange({ recommend: [] })}
      />
      <MultiFilterChips
        label="속성"
        options={PATTERN_CHIPS}
        selected={filters.pattern}
        onToggle={(value) => onChange({ pattern: toggleValue(filters.pattern, value, PATTERN_OPTIONS) })}
        onClear={() => onChange({ pattern: [] })}
      />
    </>
  );
}
