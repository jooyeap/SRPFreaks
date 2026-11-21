"use client";

import Link from "next/link";
import { Fragment, useId, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { FolderUserRecordsPanel } from "@/components/admin/FolderUserRecordsPanel";
import { Segment } from "@/components/rivals/Segment";
import type { FolderDistributionPage } from "@/lib/chart-stats";
import { averageText } from "@/lib/chart-stats";
import { PLAYER_TIER_MINS } from "@/lib/chart-tier";
import {
  averageSegments,
  buildBuckets,
  buildWindows,
  busiestGroup,
  busiestWindow,
  inTierGroup,
  kstDate,
  layoutDotX,
  S_LINE,
  SS_LINE,
  tierGroupLabel,
  TIER_GROUPS,
  windowOf,
  yPercent,
  yRange,
  type DistBucket,
  type DistPoint,
  type DistWindow,
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

/**
 * 한 폴더 칸의 최소 폭(px). 좁은 화면(360px)에서 구간 칩(0.1 = 10칸, 0.5 = 4칸)이 가로 스크롤 없이 한 화면에 들어가도록 정했다:
 * 도표 폭 ≈ 360 − 페이지 여백 32 − 카드 안쪽 26 − y축 32 = 270px → 0.1 단위 10칸 × 27, 0.5 단위 4칸 × 64(남는 폭은 칸이 나눠 가진다).
 * `전체 구간`을 고르면 칸이 더 많아져 도표 안에서만 가로로 밀린다(페이지는 밀리지 않는다).
 */
const COL_WIDTH: Record<FolderUnit, number> = { "0.1": 27, "0.5": 64 };
/** 도표 높이. 모바일에서도 점이 위아래로 퍼질 수 있게 충분히 크게(예전 h-60 = 240px). 점 겹침 계산의 기준 높이(PLOT_PX)와 같아야 한다. */
const PLOT_HEIGHT = "h-72 sm:h-80";
const PLOT_PX = 288;
/** 점 지름(px). 작게 그리고 반투명으로 겹침을 줄인다. 누르는 영역(24px)은 따로 있어 작아져도 누르기 쉽다. */
const DOT_PX = 10;

/**
 * 폴더 분포(D88·D97, ROOT·ADMIN): 기준 난이도 폴더마다 공개 프로필 유저의 평균 달성률을 점 하나씩 찍는다.
 * 점 색 = 그 유저의 현재 레이팅 티어 색(globals.css의 [data-tier] 변수를 그대로 쓴다. 색 값은 이 파일에 없다).
 * 색만으로 뜻을 전하지 않도록 점을 누르면 아래 카드에 티어 이름·닉네임·평균·곡 수·마지막 기록 저장일이 글자로 나오고,
 * `표로 보기`는 폴더 줄을 눌러 그 폴더의 유저 목록을 펼친다(아코디언).
 * 평균이 어떤 곡으로 계산됐는지는 점 카드의 `기록 보기`와 표의 유저 줄(한 번 더 누르기)로 펼친다(FolderUserRecordsPanel, 서버가 집계와 같은 조건으로 센다).
 * 폴더 유저가 minPlayers명 미만이면 점을 그리지 않고 「표본 부족」이다. 판정을 뜻하는 문구·색은 없다(D77).
 * 점은 SVG가 아니라 절대 위치 버튼이다: 티어 색이 그라데이션이라 SVG fill로 쓸 수 없고, 버튼이면 누르는 영역(24px)도 키보드 초점도 그대로 얻는다.
 *
 * 읽기 쉽게 하려는 장치(D97):
 * - 기본 화면을 단순화한다: 티어 강조 칩의 기본 선택 = 점이 가장 많은 티어군, 좁은 화면의 기본 구간 = 점이 가장 많은 구간.
 *   선택 밖의 점은 색을 빼고 작은 회색 점으로 둔다(색 가짓수를 줄이는 가장 단순한 방법: 새 색 체계 없이 기존 칩만 쓴다). `전체`·`전체 구간`을 누르면 모두 보인다.
 * - 점은 작게·반투명(테두리로 윤곽)·같은 폴더 안에서 결정적으로 흩뿌린다(layoutDotX).
 */
export function FolderDistribution({ data, viewerId }: { data: FolderDistributionPage; viewerId: number }) {
  const t = useTranslations("ChartStats");
  // 폴더 단위는 고르기 전까지 화면 폭을 따른다: 데스크톱(1024px 이상) 0.1, 모바일 0.5. 고르면 그 값을 쓴다.
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  const [chosenUnit, setChosenUnit] = useState<FolderUnit | null>(null);
  const unit: FolderUnit = chosenUnit ?? (wide ? "0.1" : "0.5");
  const [chosenGroup, setChosenGroup] = useState<TierGroup | null>(null);
  const [chosenWindow, setChosenWindow] = useState<number | "all" | null>(null);
  const [view, setView] = useState<ViewMode>("chart");
  const [selected, setSelected] = useState<{ start: number; userId: number } | null>(null);

  const minPlayers = data.meta.minPlayers;
  const buckets = useMemo(() => buildBuckets(data.content, data.users, unit, minPlayers), [data, unit, minPlayers]);
  // y축은 모든 묶음으로 정한다: 구간을 옮겨도 세로 눈금이 그대로라 구간끼리 높이를 견줄 수 있다.
  const range = useMemo(() => yRange(buckets), [buckets]);
  const windows = useMemo(() => buildWindows(buckets, unit), [buckets, unit]);
  const insufficient = buckets.filter((bucket) => !bucket.sufficient);

  // 고르기 전의 기본값: 티어군 = 점이 가장 많은 군, 구간 = 넓은 화면은 전체, 좁은 화면은 점이 가장 많은 구간.
  const group: TierGroup = chosenGroup ?? busiestGroup(buckets);
  const fallbackWindow = wide ? "all" : (busiestWindow(windows) ?? "all");
  const picked = chosenWindow ?? fallbackWindow;
  const windowStart: number | "all" = picked !== "all" && windows.some((w) => w.start === picked) ? picked : "all";
  const shown = useMemo(
    () => (windowStart === "all" ? buckets : buckets.filter((bucket) => windowOf(bucket, unit) === windowStart)),
    [buckets, unit, windowStart],
  );
  const segments = useMemo(() => averageSegments(shown, range), [shown, range]);
  const hasPoints = buckets.some((bucket) => bucket.sufficient);

  const pick = selected === null ? null : findPoint(shown, selected.start, selected.userId);

  if (buckets.length === 0) {
    return <p className="break-keep rounded-2xl border border-line bg-card p-4 text-sm text-fg-sub">{t("distEmpty")}</p>;
  }

  const changeUnit = (next: FolderUnit) => {
    setChosenUnit(next);
    setChosenWindow(null);
    setSelected(null);
  };
  const changeWindow = (next: number | "all") => {
    setChosenWindow(next);
    setSelected(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3">
      <p className="break-keep text-xs text-fg-sub">{t("distLead")}</p>

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
        {view === "chart" ? (
          <>
            <Segment<FolderUnit>
              label={t("unitAria")}
              value={unit}
              onChange={changeUnit}
              items={[
                { value: "0.1", text: t("unit01") },
                { value: "0.5", text: t("unit05") },
              ]}
            />
            <WindowChips windows={windows} value={windowStart} onChange={changeWindow} />
            {/* 티어군 칩 글자가 360px보다 길어(`Bronze~Iridescent` 등) 칩 줄 안에서만 가로로 밀리게 한다(페이지는 밀리지 않는다) */}
            <div className="overflow-x-auto [&>div]:min-w-max">
              <Segment<TierGroup>
                label={t("groupAria")}
                value={group}
                onChange={setChosenGroup}
                nowrap
                items={TIER_GROUPS.map((value) => ({ value, text: tierGroupLabel(value) ?? t("groupAll") }))}
              />
            </div>
          </>
        ) : null}
      </div>

      {view === "chart" ? (
        <>
          {hasPoints ? (
            <Plot
              buckets={shown}
              range={range}
              segments={segments}
              unit={unit}
              group={group}
              selected={selected}
              onSelect={setSelected}
              minPlayers={minPlayers}
            />
          ) : (
            <p className="break-keep rounded-xl bg-table-head p-3 text-sm text-fg-sub">{t("distNoPoints", { min: minPlayers })}</p>
          )}
          <PickCard key={pick ? `${pick.bucket.start}-${pick.point.userId}` : "none"} pick={pick} unit={unit} viewerId={viewerId} />
          <TierLegend buckets={shown} group={group} showAverageLine={segments.some((segment) => segment.length > 1)} />
        </>
      ) : (
        <>
          {/* 폴더 줄의 평균이 곡 가중 평균이 아님을 밝힌다(D98). 줄 자체가 버튼이라 `?` 버튼은 줄 안에 넣을 수 없어 글자로 둔다 */}
          <p className="break-keep text-[11px] text-fg-dim">{t("folderAvgNote")}</p>
          <DistTable buckets={buckets} unit={unit} viewerId={viewerId} />
        </>
      )}

      {insufficient.length > 0 ? (
        <p className="break-keep text-[11px] text-fg-dim">
          {t("insufficientNote", { min: minPlayers, list: insufficient.map((bucket) => bucket.label).join(", ") })}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 폴더 구간 이동 칩(`6.0~6.9` …, 맨 끝 `전체 구간`). 칩이 많으면 이 줄 안에서만 가로로 민다(페이지는 밀리지 않는다).
 * 선택은 굵은 글씨·테두리로도 보인다(Segment와 같은 모양). 구간이 하나뿐이면 고를 것이 없어 그리지 않는다.
 */
function WindowChips({ windows, value, onChange }: { windows: readonly DistWindow[]; value: number | "all"; onChange: (next: number | "all") => void }) {
  const t = useTranslations("ChartStats");
  if (windows.length < 2) {
    return null;
  }
  const items: { key: string; value: number | "all"; text: string }[] = [
    ...windows.map((window) => ({ key: String(window.start), value: window.start, text: window.label })),
    { key: "all", value: "all", text: t("windowAll") },
  ];
  return (
    <div role="group" aria-label={t("windowAria")} className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-table-head p-1">
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(item.value)}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-2 font-num text-xs ${on ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-sub hover:text-fg"}`}
          >
            {item.text}
          </button>
        );
      })}
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

function Plot({ buckets, range, segments, unit, group, selected, onSelect, minPlayers }: {
  buckets: DistBucket[];
  range: { min: number; max: number };
  segments: { x: number; y: number }[][];
  unit: FolderUnit;
  group: TierGroup;
  selected: { start: number; userId: number } | null;
  onSelect: (next: { start: number; userId: number } | null) => void;
  minPlayers: number;
}) {
  const t = useTranslations("ChartStats");
  const n = buckets.length;
  const ticks: number[] = [];
  for (let value = range.min; value <= range.max; value += 10) {
    ticks.push(value);
  }
  // x축 글자가 겹치지 않게 칸이 좁으면 건너뛴다(칸 폭 기준). 0.1 단위도 구간 칩으로 10칸이면 모두 들어간다.
  const labelStep = unit === "0.1" ? 2 : 1;

  // 점 가로 위치: 칸 안에 점이 나란히 놓일 수 있는 수는 칸 최소 폭에서 구한다(줄 간격이 점 지름+여유 이상이 되도록, 최소 2줄).
  // 겹침으로 보는 높이 차 = 점 지름이 차지하는 값(%) = (지름 + 1px) ÷ 도표 높이 × 값 범위. 실제 칸은 최소 폭 이상이라 계산보다 더 여유롭다.
  const slots = Math.max(2, Math.floor((COL_WIDTH[unit] * 0.7) / (DOT_PX + 1)) + 1);
  const minGap = ((DOT_PX + 1) / PLOT_PX) * (range.max - range.min);
  const xs = useMemo(() => {
    const map = new Map<string, number>();
    for (const bucket of buckets) {
      for (const [userId, fraction] of layoutDotX(bucket.points, Math.round(bucket.start * 10), slots, minGap)) {
        map.set(`${bucket.start}-${userId}`, fraction);
      }
    }
    return map;
  }, [buckets, slots, minGap]);

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
                  className="absolute inset-y-0 flex items-start justify-center overflow-hidden pt-1"
                  style={{ left: `${(index / n) * 100}%`, width: `${100 / n}%` }}
                >
                  {/* 음영만으로는 뜻이 안 전해지고 모바일에는 title(호버)이 없어서 칸 안에 `부족` 글자를 같이 둔다(D98). 음영은 따로 깔아 글자는 흐려지지 않는다 */}
                  <span aria-hidden className="absolute inset-0 bg-table-head opacity-60" />
                  <span data-insufficient-label="" className="relative break-keep text-[10px] font-bold leading-none text-fg-sub">
                    {t("insufficientShort")}
                  </span>
                </div>
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
                const x = xs.get(`${bucket.start}-${point.userId}`) ?? 0.5;
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
                    // 선택한 점은 맨 위로, 선택 밖(흐린) 점은 아래로 깔아 색 있는 점이 가려지지 않게 한다.
                    className={`absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-fg ${on ? "z-20" : dim ? "z-0" : "z-10"}`}
                    style={{ left: `${((index + x) / n) * 100}%`, top: `${yPercent(point.avg, range)}%` }}
                  >
                    {/*
                      점 = 테두리가 있는 바깥 원(윤곽) + 안쪽 색 원(반투명). 색 원만 투명하게 해서 겹친 점들이 비쳐 보이면서도 테두리는 또렷하다.
                      색은 `chart-dot`(--chart-fill)이 정하고 이 파일에는 색 값이 없다. 흐린 점은 색을 빼고 작은 회색 점으로 둔다.
                    */}
                    {dim ? (
                      <span className="block h-1.5 w-1.5 rounded-full bg-fg-dim opacity-50" />
                    ) : (
                      <span
                        className={`relative block rounded-full border ${on ? "h-3.5 w-3.5 border-2 border-fg" : "h-2.5 w-2.5 border-fg-sub"}`}
                      >
                        <i aria-hidden className={`absolute inset-0 rounded-full opacity-70 ${point.tierKey ? "chart-dot" : "bg-fg-dim"}`} />
                      </span>
                    )}
                  </button>
                );
              }),
            )}
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

/** 마지막 기록 저장일 글자: Asia/Seoul `YYYY-MM-DD`, 모르면 `-`. */
function savedDateText(iso: string | null): string {
  return kstDate(iso) ?? "-";
}

/**
 * 누른 점의 정보 카드(도표 아래). 닉네임은 여기와 `표로 보기`의 펼친 목록에서만 보인다(ROOT·ADMIN 화면).
 * 예전 말풍선은 점 위에 떠서 작은 화면에서 점·눈금을 가렸고 가장자리에서 잘렸다. 도표 아래 고정 카드는 가리지 않고 글자도 크게 쓸 수 있다.
 * 점이 없을 때는 안내 문구가 같은 자리를 차지해 도표가 위아래로 흔들리지 않는다.
 */
function PickCard({ pick, unit, viewerId }: { pick: { bucket: DistBucket; point: DistPoint; index: number } | null; unit: FolderUnit; viewerId: number }) {
  const t = useTranslations("ChartStats");
  const panelId = useId();
  // 카드는 점마다 key가 달라 새로 만들어지므로 다른 점을 누르면 기록 상세는 자동으로 접힌다
  const [open, setOpen] = useState(false);
  if (pick === null) {
    return (
      <p role="status" className="break-keep rounded-xl border border-dashed border-line p-2.5 text-[11px] text-fg-dim">
        {t("distHint")}
      </p>
    );
  }
  const { bucket, point } = pick;
  return (
    <div role="status" data-pick-card="" className="rounded-xl border border-chip-line bg-table-head p-2.5 text-xs">
      <div className="flex items-center gap-1.5">
        <i data-tier={point.tierKey ?? undefined} className={`inline-block h-3 w-3 shrink-0 rounded-full ${point.tierKey ? "chart-swatch" : "bg-fg-dim"}`} aria-hidden />
        <b className="text-fg">{point.tierName ?? t("tierUnknown")}</b>
        <span className="min-w-0 break-all text-fg">{point.nickname}</span>
      </div>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
        <Fact label={t("colFolder")} value={bucket.label} />
        <Fact label={t("colAvg")} value={averageText(point.avg) ?? "-"} />
        <Fact label={t("colCharts")} value={t("chartsValue", { n: point.charts })} />
        <Fact label={t("colLastSaved")} value={savedDateText(point.lastRecordedAt)} />
      </dl>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-ctl px-2.5 text-[11px] text-fg hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          <span aria-hidden>{open ? "▾" : "▸"}</span>
          {open ? t("recHide") : t("recShow")}
        </button>
        <Link href={`/players/${point.userId}`} className="inline-flex min-h-8 items-center text-[11px] text-fg-sub underline">
          {t("bubbleDetail")}
        </Link>
      </div>
      {open ? (
        <FolderUserRecordsPanel id={panelId} viewerId={viewerId} folder={bucket.start} unit={unit} userId={point.userId} expectedCharts={point.charts} />
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-fg-dim">{label}</dt>
      <dd className="font-num text-fg">{value}</dd>
    </div>
  );
}

/**
 * 범례: 도표에 나온 점의 티어별 인원. 색 옆에 티어 이름을 글자로 같이 적는다. 티어 표(PLAYER_TIER_MINS)의 높은 순.
 * 티어군을 고른 상태에서는 그 군의 티어만 색으로 나열하고, 나머지는 `그 밖의 티어`(회색 점) 한 줄로 합친다(도표와 같은 모양).
 * 도표에 실선이 그려져 있으면(showAverageLine) `── 폴더 점의 평균` 한 줄을 더한다(D98: 실선이 무엇인지 도표 위 안내문을 읽지 않아도 알게).
 */
function TierLegend({ buckets, group, showAverageLine }: { buckets: readonly DistBucket[]; group: TierGroup; showAverageLine: boolean }) {
  const t = useTranslations("ChartStats");
  const counts = new Map<string, { name: string; n: number }>();
  let others = 0;
  for (const bucket of buckets) {
    for (const point of bucket.points) {
      if (!inTierGroup(point.tierKey, group)) {
        others += 1;
        continue;
      }
      const key = point.tierKey ?? "";
      const prev = counts.get(key) ?? { name: point.tierName ?? t("tierUnknown"), n: 0 };
      counts.set(key, { name: prev.name, n: prev.n + 1 });
    }
  }
  const order = (key: string) => PLAYER_TIER_MINS.findIndex((tier) => tier.key === key);
  const items = [...counts.entries()].sort(([a], [b]) => order(b) - order(a));
  if (items.length === 0 && others === 0 && !showAverageLine) {
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
      {showAverageLine ? (
        <li data-legend-average="" className="flex items-center gap-1 text-[11px] text-fg-sub">
          <svg aria-hidden width="16" height="8" viewBox="0 0 16 8" className="shrink-0">
            <line x1="0" y1="4" x2="16" y2="4" className="stroke-fg-sub" strokeWidth={2} strokeLinecap="round" />
          </svg>
          {t("legendAverage")}
        </li>
      ) : null}
      {others > 0 ? (
        <li data-legend-other="" className="flex items-center gap-1 text-[11px] text-fg-sub">
          <i className="inline-block h-1.5 w-1.5 rounded-full bg-fg-dim opacity-50" aria-hidden />
          {t("legendOther")}
          <span className="font-num text-fg-dim">{t("legendCount", { n: others })}</span>
        </li>
      ) : null}
    </ul>
  );
}

/**
 * `표로 보기`: 폴더 줄(폴더·유저 수·폴더 평균)을 누르면 그 줄 안에 그 폴더의 유저 목록이 펼쳐진다(아코디언).
 * 폴더 줄은 진짜 `<button>`이라 Tab으로 닿고 Enter·Space로 열고 닫는다(키보드 처리를 따로 만들지 않는다).
 * 열림 여부는 aria-expanded로 알리고 `▸/▾` 글자도 같이 둔다(색·모양만으로 전달하지 않는다). 펼친 목록의 티어는 색과 이름을 같이 적는다.
 * 여러 폴더를 동시에 펼칠 수 있다. 표본 부족 폴더는 유저가 드러나지 않으므로 펼 수 없는 한 줄이다.
 */
function DistTable({ buckets, unit, viewerId }: { buckets: readonly DistBucket[]; unit: FolderUnit; viewerId: number }) {
  const t = useTranslations("ChartStats");
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const toggle = (start: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(start)) {
        next.add(start);
      }
      return next;
    });
  // 유저 줄을 한 번 더 누르면 그 유저의 폴더 기록 상세가 펼쳐진다(키 = `묶음시작-유저id`). 여러 유저를 동시에 펼칠 수 있다.
  const [openUsers, setOpenUsers] = useState<ReadonlySet<string>>(new Set());
  const toggleUser = (key: string) =>
    setOpenUsers((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });

  return (
    <ul aria-label={t("tableCaption")} className="divide-y divide-row-line rounded-xl border border-line">
      {buckets.map((bucket) => {
        if (!bucket.sufficient) {
          return (
            <li key={bucket.start} data-row-folder={bucket.label} className="flex items-center gap-2 px-3 py-2.5 text-xs">
              <span className="font-num font-bold text-fg">{bucket.label}</span>
              <span className="text-fg-dim">{t("insufficientRow", { n: bucket.users })}</span>
            </li>
          );
        }
        const isOpen = open.has(bucket.start);
        const panelId = `${baseId}-${bucket.start}`;
        return (
          <li key={bucket.start} data-row-folder={bucket.label}>
            <h3 className="text-xs">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(bucket.start)}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left hover:bg-table-head focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fg"
              >
                <span aria-hidden className="w-3 shrink-0 text-fg-dim">{isOpen ? "▾" : "▸"}</span>
                {/* 글자 사이의 공백은 화면 낭독이 "6.0유저 3명평균…"으로 붙여 읽지 않게 하려는 것이다 */}
                <span className="font-num font-bold text-fg">{bucket.label}</span>{" "}
                <span className="text-fg-sub">{t("folderUsers", { n: bucket.users })}</span>{" "}
                <span className="ml-auto font-num text-fg">{t("folderAvg", { avg: averageText(bucket.avg) ?? "-" })}</span>
              </button>
            </h3>
            {isOpen ? (
              <div id={panelId} data-folder-panel={bucket.label} className="px-3 pb-2">
                <p className="break-keep pb-1 text-[11px] text-fg-dim">{t("recTableHint")}</p>
                <table className="w-full table-fixed text-left text-xs">
                  <caption className="sr-only">{t("userListCaption", { folder: bucket.label })}</caption>
                  <colgroup>
                    <col />
                    <col className="w-[4.25rem]" />
                    <col className="w-9" />
                    <col className="w-[4.5rem]" />
                  </colgroup>
                  <thead className="text-fg-dim">
                    <tr>
                      <th scope="col" className="py-1 pr-2 align-bottom font-normal">{t("colNickTier")}</th>
                      <th scope="col" className="py-1 pr-1 text-right align-bottom font-normal">{t("colAvg")}</th>
                      <th scope="col" className="py-1 pr-1 text-right align-bottom font-normal">{t("colCharts")}</th>
                      <th scope="col" className="break-keep py-1 text-right align-bottom font-normal">{t("colLastSaved")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-row-line">
                    {[...bucket.points]
                      .sort((a, b) => b.avg - a.avg || a.userId - b.userId)
                      .map((point) => {
                        const userKey = `${bucket.start}-${point.userId}`;
                        const userOpen = openUsers.has(userKey);
                        const recordsId = `${panelId}-u${point.userId}`;
                        return (
                          <Fragment key={point.userId}>
                            <tr data-user-row={point.userId}>
                              <th scope="row" className="py-0 pr-2 text-left font-normal">
                                {/* 유저 줄 전체가 아니라 이름 칸이 버튼이다(표 안에서 가장 단순하게 키보드·낭독을 지킨다). 열림 여부는 aria-expanded와 ▸/▾ 글자로 알린다 */}
                                <button
                                  type="button"
                                  aria-expanded={userOpen}
                                  aria-controls={recordsId}
                                  aria-label={t("recToggleAria", { nickname: point.nickname })}
                                  onClick={() => toggleUser(userKey)}
                                  className="flex min-h-11 w-full items-start gap-1 py-1.5 text-left hover:bg-table-head focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fg"
                                >
                                  <span aria-hidden className="w-3 shrink-0 pt-px text-fg-dim">{userOpen ? "▾" : "▸"}</span>
                                  <span className="min-w-0">
                                    <span className="block break-all text-fg">{point.nickname}</span>
                                    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-fg-sub">
                                      <i data-tier={point.tierKey ?? undefined} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${point.tierKey ? "chart-swatch" : "bg-fg-dim"}`} aria-hidden />
                                      {point.tierName ?? t("tierUnknown")}
                                    </span>
                                  </span>
                                </button>
                              </th>
                              <td className="py-1.5 pr-1 text-right font-num text-fg">{averageText(point.avg)}</td>
                              <td className="py-1.5 pr-1 text-right font-num text-fg-sub">{t("chartsValue", { n: point.charts })}</td>
                              <td className="py-1.5 text-right font-num text-fg-sub">{savedDateText(point.lastRecordedAt)}</td>
                            </tr>
                            {userOpen ? (
                              <tr data-user-records={point.userId}>
                                <td colSpan={4} className="pb-2">
                                  <FolderUserRecordsPanel id={recordsId} viewerId={viewerId} folder={bucket.start} unit={unit} userId={point.userId} expectedCharts={point.charts} />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
