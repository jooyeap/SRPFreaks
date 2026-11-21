import { useId } from "react";
import { useTranslations } from "next-intl";

import { TIER_CHIP_METAL, TIER_STYLES, type CardTierStyle } from "@/lib/rating-card";

/**
 * 마이페이지 레이팅 카드의 큰 티어 배지 (DESIGN-UI 티어 표시, D87).
 *
 * - 10,000 이상 4티어(6 Fingers / Mutant / Alien / HSB)는 검정 금속 칩 + 티어 색 테두리를 SVG로 그린다.
 *   모양은 알약(6 Fingers, Mutant)과 육각(Alien, HSB). 옆 장식 선과 카드 뒤 빛은 사용자 요청으로 뺐다(2026-11-21).
 * - 그 아래 티어는 예전 칩(.tier-chip)을 그대로 쓴다.
 * 색은 컴포넌트에 직접 쓰지 않고 lib/rating-card.ts의 TIER_STYLES(globals.css와 같은 값, 테스트가 비교)에서 읽는다.
 * 움직이는 효과는 없다. 이름 글자는 SVG 안에 그대로 있어 색만으로 구분하지 않는다.
 */
export function TierBadge({ tier }: { tier: { key: string; displayName: string } }) {
  const t = useTranslations();
  const uid = useId().replace(/:/g, "");
  const style = TIER_STYLES[tier.key];
  const chip = style?.chip;
  const aria = t("Rating.tierAria", { name: tier.displayName });

  if (!style || !chip) {
    return (
      <span className="tier-chip rounded-full px-3 py-1 text-sm font-bold" aria-label={aria}>
        {tier.displayName}
      </span>
    );
  }

  const border = `${uid}-border`;
  const metal = `${uid}-metal`;
  const shine = `${uid}-shine`;
  const blur = `${uid}-blur`;

  return (
    <svg
      viewBox="58 60 144 52"
      role="img"
      aria-label={aria}
      data-tier={tier.key}
      className="block h-auto w-40 max-w-full overflow-visible"
    >
      <defs>
        <linearGradient id={border} x1="0" x2="1" y1="0" y2="0">
          {stops(style.stops)}
        </linearGradient>
        <linearGradient id={metal} x1="0" x2="0" y1="0" y2="1">
          {stops(TIER_CHIP_METAL)}
        </linearGradient>
        <linearGradient id={shine} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.62" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={blur} x="-20%" y="-40%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <Shape kind={chip.shape} y0={71} y1={105} fill="#000" opacity={0.5} filter={`url(#${blur})`} />
      <Shape kind={chip.shape} fill={`url(#${metal})`} />
      <Shape kind={chip.shape} y0={69} y1={86} inset={2} fill={`url(#${shine})`} />
      <Shape kind={chip.shape} fill="none" stroke={`url(#${border})`} strokeWidth={1.8} />
      <Shape kind={chip.shape} inset={3} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1} />
      <text
        x="130"
        y="90"
        textAnchor="middle"
        className="font-num"
        fontWeight={700}
        fontSize={13.5}
        fill={chip.text}
        style={{ filter: "drop-shadow(var(--tier-glow))" }}
      >
        {tier.displayName}
      </text>
    </svg>
  );
}

function stops(colors: readonly string[]) {
  return colors.map((color, i) => <stop key={`${color}-${i}`} offset={`${Math.round((100 * i) / (colors.length - 1))}%`} stopColor={color} />);
}

interface ShapeProps {
  kind: NonNullable<CardTierStyle["chip"]>["shape"];
  y0?: number;
  y1?: number;
  inset?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  opacity?: number;
  filter?: string;
}

/** 칩 윤곽. 칩은 x 65~195, y 68~102에 놓이고, inset만큼 안쪽으로 줄인다. */
function Shape({ kind, y0 = 68, y1 = 102, inset = 0, ...paint }: ShapeProps) {
  const a = 65 + inset;
  const b = 195 - inset;
  const c = y0 + inset;
  const d = y1 - inset;
  if (kind === "pill") {
    return <rect x={a} y={c} width={b - a} height={d - c} rx={Math.floor((d - c) / 2)} {...paint} />;
  }
  const m = (c + d) / 2;
  const points = [
    [a, m],
    [a + 15, c],
    [b - 15, c],
    [b, m],
    [b - 15, d],
    [a + 15, d],
  ]
    .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
  return <polygon points={points} {...paint} />;
}
