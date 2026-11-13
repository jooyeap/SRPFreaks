import { RivalChartTable } from "@/components/rivals/RivalChartTable";
import type { RivalPatternSummary } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { dataPoints, labelAnchor, polarPoint, radarAxes, ringPoints } from "@/lib/rival-charts";
import { useTranslations } from "next-intl";

const WIDTH = 320;
const HEIGHT = 250;
const CX = 160;
const CY = 128;
const RADIUS = 84;
const LABEL_GAP = 12;

/**
 * 속성별 승률 레이더(D67, 7단계): 속성 다섯 축, 승률 = 승 ÷ 공유 곡. 바깥 원이 100%, 점선이 50%(동률)다.
 * 공유 곡이 5곡 미만인 속성은 점을 비운 원으로 그리고 `※`를 붙인다(참고용). 공유 곡이 하나도 없는 속성은 0%가 아니라 승률 `–`이고,
 * 다각형이 찌그러지지 않게 동률 자리에 빈 원만 둔다. 꼭짓점 글자(속성 이름·승률)와 숨김 표(RivalChartTable)가 값을 글자로 전한다.
 */
export function RivalRadarChart({ patterns }: { patterns: readonly RivalPatternSummary[] }) {
  const t = useTranslations();
  const axes = radarAxes(patterns);
  const summary = axes
    .map((a) => (a.percent === null ? `${patternLabel(a.pattern, t)} –` : t("Rival.radarAxisText", { pattern: patternLabel(a.pattern, t), percent: a.percent })))
    .join(", ");
  const anySmall = axes.some((a) => a.small);

  return (
    <div className="flex flex-col gap-1.5">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t("Rival.radarAria", { summary })} className="h-auto w-full">
        <polygon points={ringPoints(axes, CX, CY, RADIUS, 1)} fill="none" className="stroke-chip-line" strokeWidth={1} />
        <polygon points={ringPoints(axes, CX, CY, RADIUS, 0.5)} fill="none" className="stroke-chip-line" strokeWidth={1} strokeDasharray="3 3" />
        {axes.map((a) => {
          const end = polarPoint(CX, CY, RADIUS, a.angle);
          return <line key={a.key} x1={CX} y1={CY} x2={end.x} y2={end.y} className="stroke-row-line" strokeWidth={1} />;
        })}
        <polygon points={dataPoints(axes, CX, CY, RADIUS)} className="fill-done stroke-done" fillOpacity={0.18} strokeWidth={1.5} strokeLinejoin="round" />
        {axes.map((a) => {
          const dot = polarPoint(CX, CY, RADIUS * a.radiusRatio, a.angle);
          const hollow = a.small;
          return (
            <circle
              key={a.key}
              data-key={a.key}
              data-hollow={hollow ? "true" : "false"}
              cx={dot.x}
              cy={dot.y}
              r={hollow ? 4 : 3.5}
              className={hollow ? "fill-card stroke-fg-dim" : "fill-done stroke-card"}
              strokeWidth={hollow ? 1.5 : 0.5}
            />
          );
        })}
        {axes.map((a) => {
          const p = polarPoint(CX, CY, RADIUS + LABEL_GAP, a.angle);
          const sin = Math.sin((a.angle * Math.PI) / 180);
          const [nameY, rateY] = sin < -0.5 ? [p.y - 13, p.y] : sin > 0.5 ? [p.y + 10, p.y + 23] : [p.y - 3, p.y + 10];
          const anchor = labelAnchor(a.angle);
          return (
            <g key={a.key}>
              <text x={p.x} y={nameY} textAnchor={anchor} className="fill-fg text-[11px]">
                {patternLabel(a.pattern, t)}
              </text>
              <text x={p.x} y={rateY} textAnchor={anchor} className="fill-fg-sub font-num text-[11px] font-bold">
                {a.percent === null ? "–" : `${a.percent}%${a.small ? " ※" : ""}`}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-fg-dim">{t("Rival.radarLegend")}</p>
      {anySmall ? <p className="text-[11px] text-fg-dim">{t("Rival.smallSample")}</p> : null}
      <RivalChartTable patterns={patterns} />
    </div>
  );
}
