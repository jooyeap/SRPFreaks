/** 한 줄 필터: `라벨  [전체] [옵션1] [옵션2] ...`. 선택된 칩은 aria-pressed로도 알린다(색만으로 구분하지 않는다). */
export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export function FilterChips<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly ChipOption<T>[];
  /** null이면 "전체" */
  selected: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-fg-dim">{label}</span>
      <Chip pressed={selected === null} onClick={() => onChange(null)}>
        전체
      </Chip>
      {options.map((option) => (
        <Chip key={option.value} pressed={selected === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

export function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm ${
        pressed ? "border-transparent bg-chip-on-bg text-chip-on-fg" : "border-chip-line text-fg-sub hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
