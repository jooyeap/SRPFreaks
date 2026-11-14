"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import { chartKindText, chartStatsHref, deviationBarPercent, tierText, type StatsChart } from "@/lib/chart-stats";
import { HIT_ROW } from "@/lib/hit-area";

/**
 * 서열표 분석(D77) 화면들이 같이 쓰는 작은 조각. 색은 토큰만 쓰고, 판정을 뜻하는 색(경고·좋음/나쁨)은 쓰지 않는다:
 * 값은 글자(숫자와 +/− 부호)가 전하고, 막대는 장식(aria-hidden)이다.
 */

/** 곡 이름(상세 화면 링크) + `Guitar | MAS 9.93 · 6.4`(기준 난이도, 없으면 미정). */
export function ChartCell({ chart }: { chart: StatsChart }) {
  const t = useTranslations("ChartStats");
  const tier = tierText(chart.tier);
  return (
    <div className="min-w-0">
      <Link
        href={chartStatsHref(chart.songDifficultyId)}
        aria-label={t("openChartAria", { title: chart.title })}
        className={`${HIT_ROW} block text-sm font-bold text-fg hover:underline`}
      >
        <span className="block truncate">{chart.title}</span>
      </Link>
      <p className="font-num text-[11px] text-fg-dim">
        {chartKindText(chart)} · {tier ?? t("undecided")}
      </p>
    </div>
  );
}

/** 숫자 칸: 모바일에서는 앞에 이름이 붙고(작은 글자), 1024px 이상 표에서는 머리 줄이 이름을 맡아 숨긴다. */
export function StatCell({ label, children, muted = false }: { label: string; children: ReactNode; muted?: boolean }) {
  return (
    <span className={`font-num text-xs tabular-nums ${muted ? "text-fg-dim" : "text-fg"}`}>
      <span className="text-fg-dim lg:hidden">{label} </span>
      {children}
    </span>
  );
}

/** 표 머리 줄(1024px 이상에서만 보인다). 열 크기는 줄과 같은 grid 값을 받는다. */
export function TableHead({ columns, labels }: { columns: string; labels: readonly string[] }) {
  return (
    <div aria-hidden="true" className={`hidden gap-3 border-b border-line bg-table-head px-4 py-2 text-[11px] font-bold text-fg-sub lg:grid ${columns}`}>
      {labels.map((label, index) => (
        <span key={`${label}-${index}`}>{label}</span>
      ))}
    </div>
  );
}

/**
 * 가운데(0)에서 좌우로 뻗는 편차 막대(장식). 오른쪽 = 곡 평균이 폴더 평균보다 높음, 왼쪽 = 낮음.
 * 색은 하나(중립)라서 방향·길이와 옆의 +/− 숫자로 읽는다. 값이 없으면(표본 부족) 가운데 선만 보인다.
 */
export function DeviationBar({ value }: { value: number | null }) {
  const percent = deviationBarPercent(value);
  const right = value !== null && value > 0;
  return (
    <div aria-hidden="true" data-testid="deviation-bar" className="relative h-2 w-full min-w-24 rounded bg-table-head">
      <div className="absolute inset-y-0 left-1/2 w-px bg-chip-line" />
      {percent > 0 ? (
        <div
          style={{ width: `${percent / 2}%` }}
          className={`absolute inset-y-0 bg-fg-dim ${right ? "left-1/2 rounded-r" : "right-1/2 rounded-l"}`}
        />
      ) : null}
    </div>
  );
}

/** 목록 상태: 불러오는 중 / 실패(다시 시도) / 비었음. 내용이 있으면 children. */
export function ListState({
  pending,
  error,
  onRetry,
  retrying,
  empty,
  emptyText,
  children,
}: {
  pending: boolean;
  error: boolean;
  onRetry: () => void;
  retrying: boolean;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  const t = useTranslations("ChartStats");
  if (pending) {
    return <p className="text-sm text-fg-sub">{t("loading")}</p>;
  }
  if (error) {
    return (
      <ErrorRetry onRetry={onRetry} retrying={retrying}>
        {t("loadFailed")}
      </ErrorRetry>
    );
  }
  if (empty) {
    return <p className="rounded-2xl border border-line bg-card p-4 text-sm text-fg-sub">{emptyText}</p>;
  }
  return <>{children}</>;
}
