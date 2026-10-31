import { CheckChip, MultiFilterChips, Segmented, type ChipOption } from "@/components/table/FilterChips";
import { PATTERN_OPTIONS, RECOMMEND_OPTIONS, toggleValue, type TableFilters } from "@/lib/difficulty-table";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";


/** 접힌 필터 줄에 보여 줄 요약. 걸린 필터가 없으면 "전체". 서열표 본문과 묶음 화면이 같이 쓴다. */
export function filterSummary(filters: TableFilters, includeZero: boolean, t: Translator): string {
  const picked = [
    filters.recommend.length > 0 ? t("Table.summaryRecommend", { values: filters.recommend.map((v) => recommendLabel(v, t)).join("·") }) : null,
    filters.pattern.length > 0
      ? t("Table.summaryPattern", {
          values: patternMode(filters.pattern) === "notSingle" && filters.pattern.length === NOT_SINGLE.length ? t("Table.patternNotSingle") : filters.pattern.map((v) => patternLabel(v, t)).join("·"),
        })
      : null,
  ].filter((v): v is string => Boolean(v));
  const average = includeZero ? t("Table.avgWithZero") : t("Table.avgWithoutZero");
  return `${picked.length > 0 ? picked.join(" · ") : t("Songs.all")} · ${average}`;
}

/** 단일이 아닌 속성(복합·이중·삼중). `단일 외`를 고르면 처음에는 셋 다 켜진다. */
const NOT_SINGLE: readonly string[] = PATTERN_OPTIONS.filter((v) => v !== "단일");

type PatternMode = "single" | "notSingle";

/** 선택 목록 -> 세그먼트 칸. 없으면 전체(null), 단일만이면 single, 단일이 없으면 notSingle. 단일과 다른 것이 섞인 옛 주소는 전체로 보지 않고 notSingle 쪽 칸 없이(null) 둔다. */
export function patternMode(pattern: readonly string[]): PatternMode | null {
  if (pattern.length === 0) return null;
  if (pattern.length === 1 && pattern[0] === "단일") return "single";
  return pattern.includes("단일") ? null : "notSingle";
}

/**
 * 서열표 필터(추천 여러 개 / 속성). 서열표 본문과 묶음 화면이 함께 쓴다.
 * 파트는 2026-10-31에 뺐다(서열표는 기준 난이도로 묶여 파트 구분의 의미가 적고, 채보 배지에 Guitar/Bass가 그대로 보인다).
 * 속성은 레이팅 두 목록과 같은 나눔인 `전체 / 단일 / 단일 외` 중 하나를 고르고, `단일 외`일 때만 복합·이중·삼중을 세부로 고른다.
 * 값을 직접 바꾸지 않고 바뀐 부분(patch)만 부모에게 알린다.
 */
export function TableFilterPanel({ filters, onChange }: { filters: TableFilters; onChange: (patch: Partial<TableFilters>) => void }) {
  const t = useTranslations();
  // 값(상/중/하, 단일/복합…)은 서버·주소가 쓰는 그대로고, 칩에 보이는 글자만 현재 언어로 바꾼다
  const recommendChips: readonly ChipOption<string>[] = RECOMMEND_OPTIONS.map((v) => ({ value: v, label: recommendLabel(v, t) }));
  const mode = patternMode(filters.pattern);
  const subChips: readonly ChipOption<string>[] = NOT_SINGLE.map((v) => ({ value: v, label: patternLabel(v, t) }));
  return (
    <>
      <MultiFilterChips
        label={t("Table.filterRecommend")}
        options={recommendChips}
        selected={filters.recommend}
        onToggle={(value) => onChange({ recommend: toggleValue(filters.recommend, value, RECOMMEND_OPTIONS) })}
        onClear={() => onChange({ recommend: [] })}
      />
      <Segmented<PatternMode>
        label={t("Table.filterPattern")}
        items={[
          { value: null, label: t("Songs.all") },
          { value: "single", label: patternLabel("단일", t) },
          { value: "notSingle", label: t("Table.patternNotSingle") },
        ]}
        value={mode}
        onChange={(next) => onChange({ pattern: next === null ? [] : next === "single" ? ["단일"] : [...NOT_SINGLE] })}
      />
      {mode === "notSingle" ? (
        <div role="group" aria-label={t("Table.patternNotSingleDetail")} className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-fg-dim">{t("Table.patternNotSingleDetail")}</span>
          {subChips.map((chip) => {
            const on = filters.pattern.includes(chip.value);
            // 마지막 하나는 끌 수 없다(모두 끄면 `단일 외`가 아니게 된다). 전체로 돌아가려면 위의 `전체`를 누른다
            const last = on && filters.pattern.length === 1;
            return (
              <CheckChip key={chip.value} pressed={on} disabled={last} onClick={() => onChange({ pattern: toggleValue(filters.pattern, chip.value, PATTERN_OPTIONS) })}>
                {chip.label}
              </CheckChip>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
