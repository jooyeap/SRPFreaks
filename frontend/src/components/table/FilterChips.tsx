/**
 * 필터 버튼 (2026-10-13 개편, DESIGN-UI 3장).
 *  - 하나만 고르는 필터(파트, 평균 계산) -> 세그먼트(Segmented): 한 줄에 붙은 칸, 켜진 칸은 떠 있는 모양 + 굵은 글씨
 *  - 여러 개 고르는 필터(추천, 속성, 난이도) -> 체크 칩(CheckChip): 켜지면 ✓ + 윤곽 + 연한 배경
 * 켜진 상태는 색뿐 아니라 굵은 글씨/✓로도 보이고, 모든 버튼에 aria-pressed가 있다(색만으로 구분하지 않는다).
 * 색 값은 컴포넌트에 없고 globals.css 변수(check-*, card, table-head ...)만 쓴다.
 */
export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/** 하나만 고르는 필터. items의 value가 null인 칸은 "전체" 같은 해제 칸이다. */
export function Segmented<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly { value: T | null; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <span className="text-xs text-fg-dim">{label}</span>
      <div className="flex w-full max-w-sm rounded-[10px] border border-line bg-table-head p-[3px]">
        {items.map((item) => {
          const on = item.value === value;
          return (
            <button
              key={item.value ?? "all"}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(item.value)}
              className={`min-h-9 flex-1 rounded-lg px-2 text-sm ${
                on ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-dim hover:text-fg"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 하나만 고르는 필터: `전체`(해제) + 옵션들. */
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
  return <Segmented label={label} items={[{ value: null, label: "전체" }, ...options]} value={selected} onChange={onChange} />;
}

/** 평균 계산 `0% 미포함 / 0% 포함` (서열표·묶음·곡 목록 공통). 미포함이 기본이다. */
export function AverageToggle({ includeZero, onChange }: { includeZero: boolean; onChange: (includeZero: boolean) => void }) {
  return (
    <Segmented
      label="평균 계산"
      items={[
        { value: "exclude", label: "0% 미포함" },
        { value: "include", label: "0% 포함" },
      ]}
      value={includeZero ? "include" : "exclude"}
      onChange={(next) => onChange(next === "include")}
    />
  );
}

/** 여러 개 고르는 필터의 칩 하나. 켜지면 ✓가 앞에 붙는다. */
export function CheckChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-sm ${
        pressed ? "border-check-line bg-check-bg font-bold text-check-fg" : "border-chip-line text-fg-sub hover:text-fg"
      }`}
    >
      {pressed ? <span aria-hidden="true">✓</span> : null}
      {children}
    </button>
  );
}

/**
 * 여러 개 고르는 필터 한 줄: `라벨  [전체] [옵션1] [옵션2] ...`.
 * 아무것도 고르지 않은 상태가 "전체"이고, `전체`를 누르면 모두 해제한다. 옵션 칩은 누를 때마다 켜고 끈다.
 */
export function MultiFilterChips<T extends string>({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: readonly ChipOption<T>[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  onClear: () => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <span className="text-xs text-fg-dim">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <CheckChip pressed={selected.length === 0} onClick={onClear}>
          전체
        </CheckChip>
        {options.map((option) => (
          <CheckChip key={option.value} pressed={selected.includes(option.value)} onClick={() => onToggle(option.value)}>
            {option.label}
          </CheckChip>
        ))}
      </div>
    </div>
  );
}
