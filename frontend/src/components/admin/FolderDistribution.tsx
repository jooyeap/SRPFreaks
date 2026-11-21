"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Segment } from "@/components/rivals/Segment";
import type { FolderDistributionPage } from "@/lib/chart-stats";
import { averageText } from "@/lib/chart-stats";
import { PLAYER_TIER_MINS } from "@/lib/chart-tier";
import {
  averageSegments,
  buildBuckets,
  inTierGroup,
  jitterFraction,
  S_LINE,
  SS_LINE,
  tierGroupLabel,
  TIER_GROUPS,
  yPercent,
  yRange,
  type DistBucket,
  type DistPoint,
  type FolderUnit,
  type TierGroup,
} from "@/lib/folder-distribution";

type ViewMode = "chart" | "table";

const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void): () => void {
  const media = window.matchMedia?.(WIDE_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function isWide(): boolean {
  return window.matchMedia?.(WIDE_QUERY).matches ?? false;
}

/** 한 폴더 칸의 최소 폭(px). 0.1 단위는 칸이 많아 좁은 화면에서는 도표 안에서만 가로로 밀린다(페이지는 밀리지 않는다). */
const COL_WIDTH: Record<FolderUnit, number> = { "0.1": 26, "0.5": 34 };
const PLOT_HEIGHT = "h-60";

/**
 * 폴더 분포(D88, ROOT·ADMIN): 기준 난이도 폴더마다 공개 프로필 유저의 평균 달성률을 점 하나씩 찍는다.
 * 점 색 = 그 유저의 현재 레이팅 티어 색(globals.css의 [data-tier] 변수를 그대로 쓴다. 색 값은 이 파일에 없다).
 * 색만으로 뜻을 전하지 않도록 점을 누르면 티어 이름·닉네임·평균·곡 수가 글자로 나오고, `표로 보기`로 같은 값을 표로 본다.
 * 폴더 유저가 minPlayers명 미만이면 점을 그리지 않고 「표본 부족」이다. 판정을 뜻하는 문구·색은 없다(D77).
 * 점은 SVG가 아니라 절대 위치 버튼이다: 티어 색이 그라데이션이라 SVG fill로 쓸 수 없고, 버튼이면 누르는 영역(24px)도 키보드 초점도 그대로 얻는다.
 */
export function FolderDistribution({ data }: { data: FolderDistributionPage }) {
  const t = useTranslations("ChartStats");
  // 폴더 단위는 고르기 전까지 화면 폭을 따른다: 데스크톱(1024px 이상) 0.1, 모바일 0.5. 고르면 그 값을 쓴다.
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  const [chosenUnit, setChosenUnit] = useState<FolderUnit | null>(null);
  const unit: FolderUnit = chosenUnit ?? (wide ? "0.1" : "0.5");
  const [group, setGroup] = useState<TierGroup>("all");
  const [view, setView] = useState<ViewMode>("chart");
  const [selected, setSelected] = useState<{ start: number; userId: number } | null>(null);

  const minPlayers = data.meta.minPlayers;
  const buckets = useMemo(() => buildBuckets(data.content, data.users, unit, minPlayers), [data, unit, minPlayers]);
  const range = useMemo(() => yRange(buckets), [buckets]);
  const segments = useMemo(() => averageSegments(buckets, range), [buckets, range]);
  const insufficient = buckets.filter((bucket) => !bucket.sufficient);
  const hasPoints = buckets.some((bucket) => bucket.sufficient);

  const pick = selected === null ? null : findPoint(buckets, selected.start, selected.userId);

  if (buckets.length === 0) {
    return <p className="rounded-2xl border border-line bg-card p-4 text-sm text-fg-sub">{t("distEmpty")}</p>;
  }

  const changeUnit = (next: FolderUnit) => {
    setChosenUnit(next);
    setSelected(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3">
      <p className="text-xs text-fg-sub">{t("distLead")}</p>

      <div className="flex flex-col gap-2">
        <Segment<ViewMode>
          label={t("viewAria")}
          value={view}
          onChange={setView}
          items={[
            { value: "chart", text: t("viewChart") },
            { value: "table", text: t("viewTable") },
          ]}
        />
        <Segment<FolderUnit>
          label={t("unitAria")}
          value={unit}
          onChange={changeUnit}
          items={[
            { value: "0.1", text: t("unit01") },
            { value: "0.5", text: t("unit05") },
          ]}
        />
        {view === "chart" ? (
          <Segment<TierGroup>
            label={t("groupAria")}
            value={group}
            onChange={setGroup}
            nowrap
            items={TIER_GROUPS.map((value) => ({ value, text: tierGroupLabel(value) ?? t("groupAll") }))}
          />
        ) : null}
      </div>

      {view === "chart" ? (
        <>
          {hasPoints ? (
            <Plot
              buckets={buckets}
              range={range}
              segments={segments}
              unit={unit}
              group={group}
              selected={selected}
              onSelect={setSelected}
              pick={pick}
              minPlayers={minPlayers}
            />
          ) : (
            <p className="rounded-xl bg-table-head p-3 text-sm text-fg-sub">{t("distNoPoints", { min: minPlayers })}</p>
          )}
          <p role="status" className="min-h-4 text-[11px] text-fg-dim">
            {pick ? null : t("distHint")}
          </p>
          <TierLegend buckets={buckets} />
        </>
      ) : (
        <DistTable buckets={buckets} />
      )}

      {insufficient.length > 0 ? (
        <p className="text-[11px] text-fg-dim">
          {t("insufficientNote", { min: minPlayers, list: insufficient.map((bucket) => bucket.label).join(", ") })}
        </p>
      ) : null}
    </div>
  );
}

function findPoint(buckets: readonly DistBucket[], start: number, userId: number): { bucket: DistBucket; point: DistPoint; index: number } | null {
  const index = buckets.findIndex((bucket) => bucket.start === start);
  if (index < 0) {
    return null;
  }
  const point = buckets[index].points.find((p) => p.userId === userId);
  return point ? { bucket: buckets[index], point, index } : null;
}

function Plot({ buckets, range, segments, unit, group, selected, onSelect, pick, minPlayers }: {
  buckets: DistBucket[];
  range: { min: number; max: number };
  segments: { x: number; y: number }[][];
  unit: FolderUnit;
  group: TierGroup;
  selected: { start: number; userId: number } | null;
  onSelect: (next: { start: number; userId: number } | null) => void;
  pick: { bucket: DistBucket; point: DistPoint; index: number } | null;
  minPlayers: number;
}) {
  const t = useTranslations("ChartStats");
  const n = buckets.length;
  const ticks: number[] = [];
  for (let value = range.min; value <= range.max; value += 10) {
    ticks.push(value);
  }
  // x축 글자가 겹치지 않게 칸이 좁으면 건너뛴다(칸 폭 기준).
  const labelStep = unit === "0.1" ? 2 : 1;

  return (
    <div className="flex">
      {/* y축 글자: 도표가 가로로 밀려도 제자리에 있다 */}
      <div aria-hidden className={`relative w-8 shrink-0 ${PLOT_HEIGHT}`}>
        {ticks.map((value) => (
          <span key={value} className="absolute right-1 -translate-y-1/2 font-num text-[10px] text-fg-dim" style={{ top: `${yPercent(value, range)}%` }}>
            {value}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div style={{ minWidth: n * COL_WIDTH[unit] }}>
          <div
            role="group"
            aria-label={t("plotAria")}
            className={`relative ${PLOT_HEIGHT} border-b border-line`}
            onClick={() => onSelect(null)}
          >
            {ticks.map((value) => (
              <div key={value} aria-hidden className="absolute inset-x-0 border-t border-row-line" style={{ top: `${yPercent(value, range)}%` }} />
            ))}
            {[
              { value: S_LINE, text: t("lineS", { n: S_LINE }) },
              { value: SS_LINE, text: t("lineSS", { n: SS_LINE }) },
            ].map((line) => (
              <div
                key={line.value}
                aria-hidden
                data-reference-line={line.value}
                className="absolute inset-x-0 border-t border-dashed border-fg-dim"
                style={{ top: `${yPercent(line.value, range)}%` }}
              >
                <span className="absolute right-0 -translate-y-full bg-card px-1 font-num text-[10px] font-bold text-fg-sub">{line.text}</span>
              </div>
            ))}
            {buckets.map((bucket, index) =>
              bucket.sufficient ? null : (
                <div
                  key={bucket.start}
                  data-insufficient={bucket.label}
                  title={t("insufficient")}
                  aria-hidden
                  className="absolute inset-y-0 bg-table-head opacity-60"
                  style={{ left: `${(index / n) * 100}%`, width: `${100 / n}%` }}
                />
              ),
            )}
            <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {segments.map((segment, index) =>
                segment.length > 1 ? (
                  <polyline
                    key={index}
                    data-average-line=""
                    points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    className="stroke-fg-sub"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null,
              )}
            </svg>
            {buckets.map((bucket, index) =>
              bucket.points.map((point) => {
                const on = selected?.start === bucket.start && selected.userId === point.userId;
                const dim = !inTierGroup(point.tierKey, group);
                return (
                  <button
                    key={`${bucket.start}-${point.userId}`}
                    type="button"
                    data-dot=""
                    data-tier={point.tierKey ?? undefined}
                    data-dimmed={dim ? "" : undefined}
                    aria-pressed={on}
                    aria-label={t("dotAria", { folder: bucket.label, tier: point.tierName ?? t("tierUnknown"), avg: averageText(point.avg) ?? "" })}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(on ? null : { start: bucket.start, userId: point.userId });
                    }}
                    className={`absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-fg ${dim ? "opacity-20" : ""}`}
                    style={{ left: `${((index + jitterFraction(point.userId)) / n) * 100}%`, top: `${yPercent(point.avg, range)}%` }}
                  >
                    <span
                      className={`block rounded-full ${point.tierKey ? "tier-bar" : "bg-fg-dim"} ${on ? "h-4 w-4 ring-2 ring-fg" : "h-3 w-3 ring-1 ring-card"}`}
                      style={{ boxShadow: on ? undefined : "var(--tier-glow)" }}
                    />
                  </button>
                );
              }),
            )}
            {pick ? <Bubble pick={pick} range={range} n={n} /> : null}
          </div>
          <div aria-hidden className="relative h-5">
            {buckets.map((bucket, index) =>
              index % labelStep === 0 ? (
                <span
                  key={bucket.start}
                  className={`absolute top-1 -translate-x-1/2 whitespace-nowrap font-num text-[10px] ${bucket.sufficient ? "text-fg-sub" : "text-fg-dim"}`}
                  style={{ left: `${((index + 0.5) / n) * 100}%` }}
                >
                  {unit === "0.1" ? bucket.label : bucket.label.split("~")[0]}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <span className="sr-only">{t("distSrNote", { min: minPlayers })}</span>
    </div>
  );
}

/** 점을 눌렀을 때의 말풍선. 닉네임은 여기서만 보인다. 위쪽 점은 아래로, 아래쪽 점은 위로 열린다. */
function Bubble({ pick, range, n }: { pick: { bucket: DistBucket; point: DistPoint; index: number }; range: { min: number; max: number }; n: number }) {
  const t = useTranslations("ChartStats");
  const { bucket, point, index } = pick;
  const y = yPercent(point.avg, range);
  const below = y < 45;
  return (
    <div
      role="status"
      data-bubble=""
      onClick={(event) => event.stopPropagation()}
      className="absolute z-20 w-44 rounded-xl border border-chip-line bg-card p-2 text-xs shadow-lg"
      style={{
        left: `clamp(92px, ${((index + jitterFraction(point.userId)) / n) * 100}%, calc(100% - 92px))`,
        top: `${y}%`,
        transform: below ? "translate(-50%, 14px)" : "translate(-50%, calc(-100% - 14px))",
      }}
    >
      <div className="flex items-center gap-1.5">
        <i data-tier={point.tierKey ?? undefined} className={`inline-block h-3 w-3 shrink-0 rounded-full ${point.tierKey ? "chart-swatch" : "bg-fg-dim"}`} aria-hidden />
        <b className="text-fg">{point.tierName ?? t("tierUnknown")}</b>
      </div>
      <p className="mt-0.5 break-all text-fg">{point.nickname}</p>
      <p className="mt-0.5 font-num text-fg-sub">
        {t("bubbleSummary", { avg: averageText(point.avg) ?? "", charts: point.charts, folder: bucket.label })}
      </p>
      <Link href={`/players/${point.userId}`} className="mt-1 inline-flex min-h-6 items-center text-[11px] text-fg-sub underline">
        {t("bubbleDetail")}
      </Link>
    </div>
  );
}

/** 범례: 도표에 나온 점의 티어별 인원. 색 옆에 티어 이름을 글자로 같이 적는다. 티어 표(PLAYER_TIER_MINS)의 높은 순. */
function TierLegend({ buckets }: { buckets: readonly DistBucket[] }) {
  const t = useTranslations("ChartStats");
  const counts = new Map<string, { name: string; n: number }>();
  for (const bucket of buckets) {
    for (const point of bucket.points) {
      const key = point.tierKey ?? "";
      const prev = counts.get(key) ?? { name: point.tierName ?? t("tierUnknown"), n: 0 };
      counts.set(key, { name: prev.name, n: prev.n + 1 });
    }
  }
  const order = (key: string) => PLAYER_TIER_MINS.findIndex((tier) => tier.key === key);
  const items = [...counts.entries()].sort(([a], [b]) => order(b) - order(a));
  if (items.length === 0) {
    return null;
  }
  return (
    <ul aria-label={t("legendAria")} className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map(([key, item]) => (
        <li key={key || "unknown"} className="flex items-center gap-1 text-[11px] text-fg-sub">
          <i data-tier={key || undefined} className={`inline-block h-3 w-3 rounded-full ${key ? "chart-swatch" : "bg-fg-dim"}`} aria-hidden />
          {item.name}
          <span className="font-num text-fg-dim">{t("legendCount", { n: item.n })}</span>
        </li>
      ))}
    </ul>
  );
}

/** `표로 보기`: 점 도표와 같은 값을 폴더 순서로. 접근성·모바일 대체 표라서 닉네임은 도표와 같이 숨긴다(점을 눌러야 보인다). */
function DistTable({ buckets }: { buckets: readonly DistBucket[] }) {
  const t = useTranslations("ChartStats");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{t("tableCaption")}</caption>
        <thead className="text-fg-dim">
          <tr>
            <th scope="col" className="py-1 pr-2 font-normal">{t("colFolder")}</th>
            <th scope="col" className="py-1 pr-2 font-normal">{t("colTierName")}</th>
            <th scope="col" className="py-1 pr-2 text-right font-normal">{t("colAvg")}</th>
            <th scope="col" className="py-1 text-right font-normal">{t("colCharts")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-row-line">
          {buckets.map((bucket) =>
            bucket.sufficient ? (
              [...bucket.points]
                .sort((a, b) => b.avg - a.avg)
                .map((point, i) => (
                  <tr key={`${bucket.start}-${point.userId}`} data-row-folder={bucket.label}>
                    <th scope="row" className="py-1.5 pr-2 font-num font-bold text-fg">{i === 0 ? bucket.label : ""}</th>
                    <td className="py-1.5 pr-2 text-fg">
                      <span className="inline-flex items-center gap-1">
                        <i data-tier={point.tierKey ?? undefined} className={`inline-block h-3 w-3 rounded-full ${point.tierKey ? "chart-swatch" : "bg-fg-dim"}`} aria-hidden />
                        {point.tierName ?? t("tierUnknown")}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-num text-fg">{averageText(point.avg)}</td>
                    <td className="py-1.5 text-right font-num text-fg-sub">{t("chartsValue", { n: point.charts })}</td>
                  </tr>
                ))
            ) : (
              <tr key={bucket.start} data-row-folder={bucket.label}>
                <th scope="row" className="py-1.5 pr-2 font-num font-bold text-fg">{bucket.label}</th>
                <td colSpan={3} className="py-1.5 text-fg-dim">{t("insufficientRow", { n: bucket.users })}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
