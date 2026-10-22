import { FilterChips, MultiFilterChips, type ChipOption } from "@/components/table/FilterChips";
import { PATTERN_OPTIONS, RECOMMEND_OPTIONS, toggleValue, type TableFilters } from "@/lib/difficulty-table";
import type { InstrumentPart } from "@/lib/types";
import { useTranslations } from "next-intl";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";

export const PART_OPTIONS: readonly ChipOption<InstrumentPart>[] = [
  { value: "GUITAR", label: "Guitar" },
  { value: "BASS", label: "Bass" },
];

/**
 * 서열표 필터 칩 세 줄(파트 하나 / 추천 여러 개 / 속성 여러 개). 서열표 본문과 묶음 화면이 함께 쓴다.
 * 값을 직접 바꾸지 않고 바뀐 부분(patch)만 부모에게 알린다.
 */
export function TableFilterPanel({ filters, onChange }: { filters: TableFilters; onChange: (patch: Partial<TableFilters>) => void }) {
  const t = useTranslations();
  // 값(상/중/하, 단일/복합…)은 서버·주소가 쓰는 그대로고, 칩에 보이는 글자만 현재 언어로 바꾼다
  const recommendChips: readonly ChipOption<string>[] = RECOMMEND_OPTIONS.map((v) => ({ value: v, label: recommendLabel(v, t) }));
  const patternChips: readonly ChipOption<string>[] = PATTERN_OPTIONS.map((v) => ({ value: v, label: patternLabel(v, t) }));
  return (
    <>
      <FilterChips label={t("Songs.part")} options={PART_OPTIONS} selected={filters.part} onChange={(part) => onChange({ part })} />
      <MultiFilterChips
        label={t("Table.filterRecommend")}
        options={recommendChips}
        selected={filters.recommend}
        onToggle={(value) => onChange({ recommend: toggleValue(filters.recommend, value, RECOMMEND_OPTIONS) })}
        onClear={() => onChange({ recommend: [] })}
      />
      <MultiFilterChips
        label={t("Table.filterPattern")}
        options={patternChips}
        selected={filters.pattern}
        onToggle={(value) => onChange({ pattern: toggleValue(filters.pattern, value, PATTERN_OPTIONS) })}
        onClear={() => onChange({ pattern: [] })}
      />
    </>
  );
}
