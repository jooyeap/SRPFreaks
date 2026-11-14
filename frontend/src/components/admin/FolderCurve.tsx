"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { averageText, layoutCurve, tierText, type FolderRow } from "@/lib/chart-stats";

// 그림 좌표(viewBox 안). 360px 폭에서 거의 1:1로 보이도록 폭 320을 쓴다.
const WIDTH = 320;
const HEIGHT = 190;
const PAD = { left: 36, right: 10, top: 10, bottom: 26 };
/** x축 글자가 겹치지 않게 한 번에 보이는 최대 개수 */
const MAX_X_LABELS = 8;

/**
 * 폴더 곡선(D77): 기준 난이도(0.1 단위)별 곡 평균 달성률을 꺾은선으로 보여 준다. 외부 라이브러리 없이 SVG다.
 * 표본 부족 폴더(평균 null)는 점이 없고, 선은 그 자리에서 끊어 건너뛴다(없는 값을 이어서 그리지 않는다).
 * 점을 누르면(키보드는 Enter·Space) 아래 줄에 그 폴더의 값이 글자로 나온다. 색은 하나(중립 토큰)라서 판정을 뜻하는 색이 없다.
 * 도형은 role="img" 하나로 읽히고 값은 아래 목록이 글자로 전한다.
 */
export function FolderCurve({ rows }: { rows: readonly FolderRow[] }) {
  const t = useTranslations("ChartStats");
  const [selected, setSelected] = useState<number | null>(null);
  const layout = layoutCurve(rows, WIDTH, HEIGHT, PAD);
  const step = Math.max(Math.ceil(rows.length / MAX_X_LABELS), 1);
  const picked = selected === null ? null : (layout.points.find((p) => p.tier === selected) ?? null);

  if (layout.points.length === 0) {
    return <p className="rounded-2xl border border-line bg-card p-4 text-sm text-fg-sub">{t("folderInsufficient")}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-3">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t("curveAria")} className="h-auto w-full">
        {layout.yTicks.map((tick) => (
          <g key={tick.value}>
            <line x1={PAD.left} y1={tick.y} x2={WIDTH - PAD.right} y2={tick.y} className="stroke-row-line" strokeWidth={1} />
            <text x={PAD.left - 6} y={tick.y + 3} textAnchor="end" className="fill-fg-dim font-num text-[10px]">
              {tick.value}
            </text>
          </g>
        ))}
        {rows.map((row, index) =>
          index % step === 0 ? (
            <text key={row.tier} x={layout.xs[index]} y={HEIGHT - 8} textAnchor="middle" className="fill-fg-dim font-num text-[10px]">
              {tierText(row.tier)}
            </text>
          ) : null,
        )}
        {layout.segments.map((segment, index) =>
          segment.length > 1 ? (
            <polyline
              key={index}
              data-segment=""
              points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              className="stroke-fg-dim"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          ) : null,
        )}
        {layout.points.map((point) => {
          const on = selected === point.tier;
          const label = t("pointAria", { tier: tierText(point.tier) ?? "", avg: averageText(point.avg) ?? "" });
          return (
            <g
              key={point.tier}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={on}
              data-point={tierText(point.tier)}
              onClick={() => setSelected(on ? null : point.tier)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(on ? null : point.tier);
                }
              }}
              className="cursor-pointer outline-none focus-visible:[&>circle:last-child]:stroke-fg"
            >
              {/* 누르는 영역은 보이는 점보다 크게(지름 24 안팎) */}
              <circle cx={point.x} cy={point.y} r={12} fill="transparent" />
              <circle cx={point.x} cy={point.y} r={on ? 5 : 3.5} className={`fill-fg ${on ? "stroke-fg" : "stroke-card"}`} strokeWidth={on ? 2 : 1} />
            </g>
          );
        })}
      </svg>
      <p role="status" className="min-h-5 font-num text-xs text-fg">
        {picked
          ? t("pointSelected", {
              tier: tierText(picked.tier) ?? "",
              avg: averageText(picked.avg) ?? "",
              charts: picked.row.chartCount,
              sampled: picked.row.sampledCharts,
            })
          : <span className="text-fg-dim">{t("curveHint")}</span>}
      </p>
      <p className="text-[11px] text-fg-dim">{t("curveSkipNote")}</p>
    </div>
  );
}
