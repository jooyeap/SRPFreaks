import { Chip, FilterChips, type ChipOption } from "@/components/table/FilterChips";
import { difficultyLabel } from "@/lib/format";
import { EMPTY_SONG_FILTERS, type SongListFilters } from "@/lib/song-list";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

const PART_OPTIONS: readonly ChipOption<InstrumentPart>[] = [
  { value: "GUITAR", label: "Guitar" },
  { value: "BASS", label: "Bass" },
];
const DIFFICULTIES: readonly DifficultyType[] = ["BASIC", "ADVANCED", "EXTREME", "MASTER"];

/**
 * 곡 목록 필터: 파트(전체/Guitar/Bass), 난이도(BAS/ADV/EXT/MAS 여러 개), 버전. 속성 필터는 두지 않는다 (DESIGN-UI 9장).
 * 난이도는 아무것도 고르지 않으면 "전체"다. 검색어는 이 패널이 아니라 위의 검색창이 다룬다.
 */
export function SongListFilterPanel({
  id,
  className,
  filters,
  versions,
  onChange,
}: {
  id: string;
  className: string;
  filters: SongListFilters;
  versions: readonly string[];
  onChange: (next: SongListFilters) => void;
}) {
  const toggleDifficulty = (d: DifficultyType) =>
    onChange({
      ...filters,
      difficulties: filters.difficulties.includes(d) ? filters.difficulties.filter((x) => x !== d) : [...filters.difficulties, d],
    });

  return (
    <div id={id} className={className}>
      <FilterChips label="파트" options={PART_OPTIONS} selected={filters.part} onChange={(part) => onChange({ ...filters, part })} />
      <div role="group" aria-label="난이도" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-fg-dim">난이도</span>
        <Chip pressed={filters.difficulties.length === 0} onClick={() => onChange({ ...filters, difficulties: [] })}>
          전체
        </Chip>
        {DIFFICULTIES.map((d) => (
          <Chip key={d} pressed={filters.difficulties.includes(d)} onClick={() => toggleDifficulty(d)}>
            {difficultyLabel(d)}
          </Chip>
        ))}
      </div>
      <label className="flex flex-wrap items-center gap-1.5 text-xs text-fg-dim">
        <span className="mr-1">버전</span>
        <select
          value={filters.version ?? ""}
          onChange={(e) => onChange({ ...filters, version: e.target.value === "" ? null : e.target.value })}
          className="rounded-full border border-chip-line bg-card px-3 py-1 text-sm text-fg"
        >
          <option value="">전체</option>
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onChange({ ...EMPTY_SONG_FILTERS, q: filters.q })}
        className="self-start rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
      >
        초기화
      </button>
    </div>
  );
}
