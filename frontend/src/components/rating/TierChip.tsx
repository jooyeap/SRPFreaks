import { useId, type SVGProps } from "react";
import { useTranslations } from "next-intl";

import {
  TIER_CHIP_SIZES,
  type TierChipShape,
  type TierChipSize,
  tierChipDarkens,
  tierChipLabel,
  tierChipHighlight,
  tierChipOf,
  tierChipWidth,
} from "@/lib/tier-chip";

/**
 * 플레이어 티어 칩(D95). 사이트에서 티어 이름을 칩으로 보여 주는 모든 곳이 이 컴포넌트 하나를 쓴다
 * (마이페이지·유저 상세의 큰 배지, 유저 목록·홈·라이벌·관리자 대시보드의 작은 칩).
 * 색·모양과 고정 폭(24티어 모두 같은 폭, 글자는 가운데 정렬, D102)은 lib/tier-chip.ts의 표·함수 하나이고, 레이팅 카드 이미지(Canvas)도 같은 표를 읽는다.
 * 이름 글자는 SVG 안의 <text>로 있어(Gradient는 `Gr.`로 줄여 쓴다, D102) 색만으로 구분하지 않는다. 접근 가능한 이름(`플레이어 티어 Gold`, 줄임말 칩도 전체 이름)은 role="group"에 붙인다
 * (role="img"로 하면 같은 영역의 차트 그림과 역할이 섞여 `getByRole("img")`가 둘을 찾는다). 움직이는 효과·글로우는 없다.
 */
export function TierChip({
  tier,
  size = "sm",
  className,
}: {
  tier: { key: string; displayName: string };
  size?: TierChipSize;
  className?: string;
}) {
  const t = useTranslations();
  // useId의 ':'는 url(#id)에서 문제가 될 수 있어 지운다. 같은 화면에 칩이 여럿이어도 그라데이션 id가 겹치지 않는다.
  const uid = useId().replace(/:/g, "");
  const spec = tierChipOf(tier.key);
  const { h, fs } = TIER_CHIP_SIZES[size];
  const label = tierChipLabel(tier.displayName);
  const w = tierChipWidth(fs);
  const pad = 2;
  const geo: Geo = { shape: spec.shape, x0: pad, y0: pad, x1: pad + w, y1: pad + h, h };
  const id = (name: string) => `${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;

  return (
    <svg
      width={w + pad * 2}
      height={h + pad * 2 + 2}
      viewBox={`0 0 ${w + pad * 2} ${h + pad * 2 + 2}`}
      role="group"
      aria-label={t("Rating.tierAria", { name: tier.displayName })}
      data-tier={tier.key}
      data-size={size}
      data-shape={spec.shape}
      className={`inline-block shrink-0 align-middle ${className ?? ""}`}
    >
      {/* 줄임말(Gr.)일 때만 마우스 올림 설명으로 전체 이름을 둔다. 같은 글자면 중복이라 두지 않는다. 스크린리더는 위 aria-label로 전체 이름을 읽는다 */}
      {label !== tier.displayName ? <title>{tier.displayName}</title> : null}
      <defs>
        <Gradient id={id("fill")} stops={spec.fill} vertical={spec.vertical} />
        {spec.border ? <Gradient id={id("border")} stops={spec.border} /> : null}
        <linearGradient id={id("shine")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={tierChipHighlight(spec)} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("dark")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <Shape geo={geo} transform="translate(0 1.2)" fill="#000" opacity={0.4} />
      <Shape geo={geo} fill={ref("fill")} />
      {tierChipDarkens(spec) ? <Shape geo={geo} fill={ref("dark")} /> : null}
      <Shape geo={geo} inset={1.5} height={h * 0.48} fill={ref("shine")} />
      {spec.border ? (
        <>
          <Shape geo={geo} fill="none" stroke={ref("border")} strokeWidth={1.5} />
          <Shape geo={geo} inset={2.2} fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={1} />
        </>
      ) : (
        <Shape geo={geo} inset={0.5} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={1} />
      )}
      <text
        x={(w + pad * 2) / 2}
        y={(pad + h / 2 + fs * 0.36).toFixed(1)}
        textAnchor="middle"
        className="font-num"
        fontWeight={700}
        fontSize={fs}
        fill={spec.text}
      >
        {label}
      </text>
    </svg>
  );
}

function Gradient({ id, stops, vertical = false }: { id: string; stops: readonly string[]; vertical?: boolean }) {
  return (
    <linearGradient id={id} x1="0" x2={vertical ? 0 : 1} y1="0" y2={vertical ? 1 : 0}>
      {stops.map((color, i) => (
        <stop key={`${color}-${i}`} offset={`${Math.round((100 * i) / (stops.length - 1))}%`} stopColor={color} />
      ))}
    </linearGradient>
  );
}

interface Geo {
  shape: TierChipShape;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 칩 높이. 육각의 뾰족한 끝 크기(높이의 0.42배, 최대 9px)를 정한다 */
  h: number;
}

type ShapeProps = { geo: Geo; inset?: number; height?: number } & Omit<SVGProps<SVGRectElement>, "height">;

/** 칩 윤곽. inset만큼 안쪽으로 줄이고, height를 주면 위에서부터 그 높이만 그린다(위쪽 하이라이트용). */
function Shape({ geo, inset = 0, height, ...paint }: ShapeProps) {
  const a = geo.x0 + inset;
  const b = geo.x1 - inset;
  const c = geo.y0 + inset;
  const e = height === undefined ? geo.y1 - inset : c + height;
  if (geo.shape === "pill") {
    return <rect x={a} y={c} width={b - a} height={e - c} rx={((e - c) / 2).toFixed(1)} {...paint} />;
  }
  const n = Math.min(9, geo.h * 0.42);
  const m = (c + e) / 2;
  const points = [
    [a, m],
    [a + n, c],
    [b - n, c],
    [b, m],
    [b - n, e],
    [a + n, e],
  ]
    .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
  return <polygon points={points} {...(paint as SVGProps<SVGPolygonElement>)} />;
}
