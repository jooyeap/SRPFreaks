import { RivalChartTable } from "@/components/rivals/RivalChartTable";
import type { RivalPatternDiffs, RivalPatternSummary } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { DOT_TICKS, diffSide, dotX, layoutDots } from "@/lib/rival-charts";
import { isSmallSample } from "@/lib/rival-dashboard";
import { useTranslations } from "next-intl";

// 그림 좌표(viewBox 안). 360px 폭에서 거의 1:1로 보이도록 폭 320을 쓴다.
const WIDTH = 320;
const PLOT_X = 76;
const PLOT_W = 232;
const LANE_H = 34;
const RADIUS = 3;
const HALF_H = 15;
const AXIS_H = 22;

const DOT_CLASS = { win: "fill-done", lose: "fill-weak", close: "fill-fg-dim" } as const;

function tickText(value: number): string {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";
}

/**
 * 속성별 점 분포(D67, 7단계): 속성마다 한 줄, 곡 하나가 점 하나. 가로 위치는 달성률 차(내 달성률 − 상대 달성률, %p, −10 ~ +10, 범위 밖은 끝에 모은다.
 * D67 개정으로 점수 차에서 바뀌었다). 가운데 ±접전 폭(서버 값, 1.0%p)은 회색 띠다. 옛 응답(`rateDistribution` 없음)이면 점이 없어 `–`로 보인다. 점이 겹치면 세로로 조금씩 어긋나게 놓는다(결정적 배치, lib/rival-charts.ts).
 * 색만으로 전달하지 않는다: 왼쪽이 열세·오른쪽이 우세라는 위치, 아래 눈금 글자, `← 열세 · 접전 · 우세 →` 안내가 같은 뜻을 말한다.
 * 도형은 role="img" 하나로 읽히고, 속성별 값은 숨김 표(RivalChartTable)가 읽어 준다.
 */
export function RivalDotChart({
  patterns,
  distribution,
  closeMargin,
}: {
  patterns: readonly RivalPatternSummary[];
  /** 속성별 달성률 차(%p) 목록(서버 `rateDistribution`). 없으면(옛 응답) 빈 목록. */
  distribution: readonly RivalPatternDiffs[] | undefined;
  closeMargin: number;
}) {
  const t = useTranslations();
  const rows = patterns.map((p) => {
    const diffs = distribution?.find((d) => d.key === p.key)?.diffs ?? [];
    return { pattern: p, dots: layoutDots(diffs, { width: PLOT_W, radius: RADIUS, halfHeight: HALF_H }) };
  });
  const height = rows.length * LANE_H + AXIS_H;
  const bandLeft = PLOT_X + dotX(-closeMargin, PLOT_W);
  const bandWidth = dotX(closeMargin, PLOT_W) - dotX(-closeMargin, PLOT_W);
  const anyClamped = rows.some((r) => r.dots.some((d) => d.clamped));
  const anySmall = patterns.some(isSmallSample);
  const axisY = rows.length * LANE_H;

  return (
    <div className="flex flex-col gap-1.5">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={t("Rival.dotAria")} className="h-auto w-full">
        <rect x={bandLeft} y={0} width={bandWidth} height={axisY} className="fill-fg-dim" fillOpacity={0.18} />
        <line x1={PLOT_X + dotX(0, PLOT_W)} y1={0} x2={PLOT_X + dotX(0, PLOT_W)} y2={axisY} className="stroke-chip-line" strokeWidth={1} />
        {rows.map(({ pattern, dots }, i) => {
          const cy = i * LANE_H + LANE_H / 2;
          return (
            <g key={pattern.key} data-key={pattern.key}>
              {i > 0 ? <line x1={0} y1={i * LANE_H} x2={WIDTH} y2={i * LANE_H} className="stroke-row-line" strokeWidth={1} /> : null}
              <text x={0} y={cy + 4} className="fill-fg text-[11px]">
                {patternLabel(pattern.pattern, t)}
                {isSmallSample(pattern) ? " ※" : ""}
              </text>
              {dots.length === 0 ? (
                <text x={PLOT_X + PLOT_W / 2} y={cy + 4} textAnchor="middle" className="fill-fg-dim text-[11px]">
                  –
                </text>
              ) : (
                dots.map((dot, k) => (
                  <circle
                    key={k}
                    data-side={diffSide(dot.diff, closeMargin)}
                    cx={PLOT_X + dot.x}
                    cy={cy + dot.dy}
                    r={RADIUS}
                    className={`${DOT_CLASS[diffSide(dot.diff, closeMargin)]} stroke-card`}
                    strokeWidth={0.5}
                  />
                ))
              )}
            </g>
          );
        })}
        <line x1={PLOT_X} y1={axisY} x2={PLOT_X + PLOT_W} y2={axisY} className="stroke-chip-line" strokeWidth={1} />
        {DOT_TICKS.map((tick) => (
          <g key={tick}>
            <line x1={PLOT_X + dotX(tick, PLOT_W)} y1={axisY} x2={PLOT_X + dotX(tick, PLOT_W)} y2={axisY + 4} className="stroke-chip-line" strokeWidth={1} />
            <text x={PLOT_X + dotX(tick, PLOT_W)} y={axisY + 16} textAnchor="middle" className="fill-fg-dim font-num text-[10px]">
              {tickText(tick)}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-center text-xs text-fg-dim">{t("Rival.dotLegend")}</p>
      {anyClamped ? <p className="text-center text-[11px] text-fg-dim">{t("Rival.dotClamped")}</p> : null}
      {anySmall ? <p className="text-[11px] text-fg-dim">{t("Rival.smallSample")}</p> : null}
      <RivalChartTable patterns={patterns} />
    </div>
  );
}
