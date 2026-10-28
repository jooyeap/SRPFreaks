import { FilterChips, MultiFilterChips, type ChipOption } from "@/components/table/FilterChips";
import { PATTERN_OPTIONS, RECOMMEND_OPTIONS, toggleValue, type TableFilters } from "@/lib/difficulty-table";
import type { InstrumentPart } from "@/lib/types";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";

export const PART_OPTIONS: readonly ChipOption<InstrumentPart>[] = [
  { value: "GUITAR", label: "Guitar" },
  { value: "BASS", label: "Bass" },
];

/** 접힌 필터 줄에 보여 줄 요약. 걸린 필터가 없으면 "전체". 서열표 본문과 묶음 화면이 같이 쓴다. */
export function filterSummary(filters: TableFilters, includeZero: boolean, t: Translator): string {
  const picked = [
    filters.part ? PART_OPTIONS.find((o) => o.value === filters.part)?.label : null,
    filters.recommend.length > 0 ? t("Table.summaryRecommend", { values: filters.recommend.map((v) => recommendLabel(v, t)).join("·") }) : null,
    filters.pattern.length > 0 ? t("Table.summaryPattern", { values: filters.pattern.map((v) => patternLabel(v, t)).join("·") }) : null,
  ].filter((v): v is string => Boolean(v));
  const average = includeZero ? t("Table.avgWithZero") : t("Table.avgWithoutZero");
  return `${picked.length > 0 ? picked.join(" · ") : t("Songs.all")} · ${average}`;
}

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
