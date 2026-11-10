import type { PlayerTierResponse } from "@/lib/api-types";

/** 둘 중 하나만 고르는 작은 전환(레이팅 목록 / 곡별 승패 같은). 선택은 굵은 글씨·테두리로도 보인다. */
export function Segment<T extends string>({ label, items, value, onChange, nowrap = false }: {
  label: string;
  items: readonly { value: T; text: string }[];
  value: T;
  onChange: (value: T) => void;
  /** true면 칸 글자를 줄바꿈하지 않고 좌우 여백을 줄여 좁은 폭(360px)에서도 한 줄에 넣는다(곡별 승패 탭). */
  nowrap?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl border border-line bg-table-head p-1">
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(item.value)}
            className={`min-h-10 rounded-lg ${nowrap ? "flex-auto whitespace-nowrap px-0.5 text-xs" : "flex-1 px-2 text-sm"} ${on ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-sub hover:text-fg"}`}
          >
            {item.text}
          </button>
        );
      })}
    </div>
  );
}

export function TierChip({ tier }: { tier: PlayerTierResponse }) {
  return (
    <span data-tier={tier.key} className="tier-chip inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold">
      {tier.displayName}
    </span>
  );
}
