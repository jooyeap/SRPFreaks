"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { dateLabel, labelStep, layoutSeries, nearestIndex } from "@/lib/dashboard";

// 그림 좌표(viewBox 안). 360px 폭에서 거의 1:1로 보이도록 폭 320을 쓴다.
const WIDTH = 320;
const HEIGHT = 176;
const PAD = { left: 34, right: 10, top: 14, bottom: 24 };
/** x축 날짜 글자가 겹치지 않게 한 번에 보이는 최대 개수 */
const MAX_X_LABELS = 6;

export interface SeriesDatum {
  /** `2026-11-15` 같은 날짜(한국 시간) */
  date: string;
  value: number;
  /** 이 점을 골랐을 때 아래에 글자로 보이는 값(화면 읽기 프로그램도 읽는다) */
  text: string;
}

/**
 * 관리자 대시보드(D80)의 날짜별 꺾은선·막대 그림. 외부 라이브러리 없이 SVG다. 색은 토큰 하나(중립)뿐이라 판정을 뜻하는 색이 없다.
 *
 * 점 고르기: 그림을 누르거나 끌면(터치·마우스 모두) 가장 가까운 날짜가 골라지고, 키보드는 그림에 포커스를 두고 ← → Home End 키로 옮긴다.
 * 고른 날짜는 그림 안에 작은 말풍선(날짜·값)으로 보이고 아래 줄에 `text`가 글자로 나온다. 처음에는 마지막 날(오늘)이 골라져 있어서
 * 그림을 누르지 않아도 오늘의 숫자가 글자로 보인다. 90일처럼 점이 많아서 점마다 따로 누르기 어려운 경우를 위해 점별 버튼이 아니라 가까운 점 고르기 방식이다.
 * 그림 자체는 role="group" 하나이고 값은 아래 글자 줄이 전한다.
 */
export function DashboardSeriesChart({
  kind,
  data,
  ariaLabel,
  hint,
  tickLabel,
}: {
  kind: "line" | "bar";
  data: readonly SeriesDatum[];
  ariaLabel: string;
  hint: string;
  /** 말풍선 글자 만드는 함수(날짜와 값을 받아 짧은 글자로). 기본은 `11/15 7` */
  tickLabel?: (datum: SeriesDatum) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const layout = layoutSeries(
    data.map((d) => d.value),
    WIDTH,
    HEIGHT,
    PAD,
  );
  const last = data.length - 1;
  // 기간이 바뀌어 점 수가 줄었는데 고른 번호가 남아 있으면 마지막 날로 돌아간다
  const index = selected !== null && selected >= 0 && selected <= last ? selected : last;
  const picked = index >= 0 ? data[index] : null;
  const step = labelStep(data.length, MAX_X_LABELS);

  /** 화면 좌표 → 그림 안의 x → 가장 가까운 점 번호 */
  function selectAt(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return;
    }
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    const next = nearestIndex(layout.xs, x);
    if (next !== null) {
      setSelected(next);
    }
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    selectAt(event.clientX);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    // 마우스는 버튼을 누른 채로 끌 때만, 터치는 손가락이 닿아 있는 동안(buttons가 1) 따라간다
    if (event.buttons > 0) {
      selectAt(event.clientX);
    }
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (data.length === 0) {
      return;
    }
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(index - 1, 0),
      ArrowRight: Math.min(index + 1, last),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setSelected(moves[event.key]);
    }
  }

  const tooltipText = picked ? (tickLabel ? tickLabel(picked) : `${dateLabel(picked.date)} ${picked.value}`) : "";
  const tooltipWidth = tooltipText.length * 6 + 14;
  const tooltipHeight = 18;
  const px = picked ? layout.xs[index] : 0;
  const py = picked ? layout.ys[index] : 0;
  const tooltipX = Math.min(Math.max(px - tooltipWidth / 2, 2), WIDTH - tooltipWidth - 2);
  // 점 위쪽에 놓고, 위가 모자라면 아래쪽에 놓는다
  const tooltipY = py - tooltipHeight - 8 >= 2 ? py - tooltipHeight - 8 : py + 10;

  return (
    <div className="flex flex-col gap-1.5">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        data-testid="dashboard-chart"
        data-kind={kind}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="h-auto w-full touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-chip-line"
      >
        {layout.yTicks.map((tick) => (
          <g key={tick.value}>
            <line x1={PAD.left} y1={tick.y} x2={WIDTH - PAD.right} y2={tick.y} className="stroke-row-line" strokeWidth={1} />
            <text x={PAD.left - 6} y={tick.y + 3} textAnchor="end" className="fill-fg-dim font-num text-[10px]">
              {tick.value}
            </text>
          </g>
        ))}
        {data.map((datum, i) =>
          i % step === 0 || i === last ? (
            // 마지막 날 글자와 바로 앞 글자가 겹치면 앞 글자를 뺀다
            i !== last && last - i < step ? null : (
              <text key={datum.date} x={layout.xs[i]} y={HEIGHT - 8} textAnchor="middle" className="fill-fg-dim font-num text-[10px]">
                {dateLabel(datum.date)}
              </text>
            )
          ) : null,
        )}
        {kind === "line" && data.length > 1 ? (
          <polyline
            data-testid="dashboard-line"
            points={layout.xs.map((x, i) => `${x},${layout.ys[i]}`).join(" ")}
            fill="none"
            className="stroke-fg-dim"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ) : null}
        {kind === "bar"
          ? data.map((datum, i) => (
              <rect
                key={datum.date}
                data-bar={datum.date}
                x={layout.xs[i] - layout.barWidth / 2}
                y={layout.ys[i]}
                width={layout.barWidth}
                height={Math.max(layout.baseline - layout.ys[i], 0)}
                rx={1}
                className={i === index ? "fill-fg" : "fill-fg-dim"}
              />
            ))
          : null}
        {picked ? (
          <g data-testid="dashboard-tooltip" pointerEvents="none">
            <line x1={px} y1={PAD.top} x2={px} y2={layout.baseline} className="stroke-chip-line" strokeWidth={1} strokeDasharray="3 3" />
            {kind === "line" ? <circle cx={px} cy={py} r={4} className="fill-fg stroke-card" strokeWidth={2} /> : null}
            <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx={4} className="fill-table-head stroke-line" strokeWidth={1} />
            <text x={tooltipX + tooltipWidth / 2} y={tooltipY + 12} textAnchor="middle" className="fill-fg font-num text-[10px] font-bold">
              {tooltipText}
            </text>
          </g>
        ) : null}
      </svg>
      <p role="status" className="min-h-5 font-num text-xs text-fg">
        {picked?.text}
      </p>
      <p className="text-[11px] text-fg-dim">{hint}</p>
    </div>
  );
}
