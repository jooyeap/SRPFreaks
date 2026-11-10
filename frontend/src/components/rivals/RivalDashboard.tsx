"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { RivalBarChart } from "@/components/rivals/RivalBarChart";
import { RivalDotChart } from "@/components/rivals/RivalDotChart";
import { RivalRadarChart } from "@/components/rivals/RivalRadarChart";
import { RateDiffChip } from "@/components/rivals/RateDiffChip";
import { Segment, TierChip } from "@/components/rivals/Segment";
import { SetlistAddCell } from "@/components/rivals/SetlistAddCell";
import { ChartLine } from "@/components/table/ChartLine";
import { ApiError } from "@/lib/api";
import type { RivalCompareRatingResponse, RivalPatternSummary } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { formatScore } from "@/lib/format";
import type { useJackets } from "@/lib/jackets";
import {
  conclusionOf,
  dashboardKeys,
  DASH_CHARTS,
  DASH_TABS,
  type DashChart,
  type DashTab,
  fetchCompareSummary,
  fetchCompareSummaryDetail,
  isSmallSample,
  mergePreview,
  PREVIEW,
  recordCounts,
  tabPatterns,
  topPattern,
} from "@/lib/rival-dashboard";
import { formatRateDiff, formatScoreDiff, formatScoreDiffTenths } from "@/lib/rivals";
import { useTranslations } from "next-intl";

/** 속성별 상세 구역의 id. 요약 카드를 누르면 이 구역으로 스크롤한다. */
const DETAIL_ID = "rival-detail";

const TAB_LABEL_KEY = { strong: "tabStrong", weak: "tabWeak", close: "tabClose" } as const;
const CHART_LABEL_KEY = { bar: "chartBar", dot: "chartDot", radar: "chartRadar" } as const;
const CARD_LABEL_KEY = { strong: "cardStrong", weak: "cardWeak", close: "cardClose" } as const;
const PREVIEW_TITLE_KEY = { strong: "previewStrong", weak: "previewWeak", close: "previewClose" } as const;

function signedSum(value: number): string {
  return formatScoreDiff(value)?.text ?? "–";
}

/** 속성별 평균 달성률 차 글자(`+1.8%`). 공유 곡이 없거나(0곡) 값이 없으면 `–`. 부호는 글자로 보인다. */
function rateDiffText(pattern: RivalPatternSummary): string {
  return pattern.sharedCount === 0 ? "–" : (formatRateDiff(pattern.rateDiffAvg) ?? "–");
}

/**
 * 속성 줄 오른쪽의 값: 우세·열세 탭은 평균 달성률 차(`+1.8%`, 아래에 작은 라벨 `평균 달성률 차`), 접전 탭은 접전 곡 수.
 * 속성을 우세·열세로 나누고 정렬하는 기준도 같은 평균 달성률 차다(D67 개정, 예전에는 점수 차 합계).
 */
function PatternValue({ pattern, tab }: { pattern: RivalPatternSummary; tab: DashTab }) {
  const t = useTranslations();
  if (tab === "close") {
    return <span className="shrink-0 font-num text-xs font-bold tabular-nums text-fg">{t("Rival.patternClose", { n: pattern.closeCount })}</span>;
  }
  return (
    <span className="flex shrink-0 flex-col items-end">
      <span className="font-num text-xs font-bold tabular-nums text-fg">{rateDiffText(pattern)}</span>
      <span className="text-[10px] leading-3 text-fg-dim">{t("Rival.rateDiffLabel")}</span>
    </span>
  );
}

/**
 * 속성 줄 아래 작은 글자 `상대만 N곡 · 나만 N곡`(D67 개정). 한쪽만 기록한 곡은 승·무·패·평균에 넣지 않으므로 따로 알린다.
 * 0이면 그 항을 생략하고 둘 다 0(또는 옛 응답에 필드 없음)이면 줄이 없다.
 */
function UnplayedLine({ pattern }: { pattern: RivalPatternSummary }) {
  const t = useTranslations();
  const theirs = pattern.onlyTheirs ?? 0;
  const mine = pattern.onlyMine ?? 0;
  if (theirs <= 0 && mine <= 0) return null;
  const parts = [theirs > 0 ? t("Rival.onlyTheirs", { n: theirs }) : null, mine > 0 ? t("Rival.onlyMine", { n: mine }) : null].filter((x) => x !== null);
  return <span className="block text-[11px] text-fg-dim">{parts.join(" · ")}</span>;
}

const SIGN_TONE = { up: "text-done-text", down: "text-weak-text", even: "text-fg-dim" } as const;

/**
 * 속성 줄 아래 작은 한 줄 `기록 나 11 · 상대 23곡 · 점수 차 −222.0`(2026-11-10).
 * 기록 수는 공유 곡 + 한쪽만(있는 값으로 계산), 점수 차는 레이팅 목록 기준(`ratingScoreDiff`, 공유 곡 기준 scoreDiffSum과 다른 값).
 * 점수 차 색은 부호에 따라 기존 토큰(초록/주황)이고 부호가 글자로 보인다. 값이 없으면(옛 응답) 점수 차 항을 뺀다.
 */
function RecordLine({ pattern }: { pattern: RivalPatternSummary }) {
  const t = useTranslations();
  const { mine, theirs } = recordCounts(pattern);
  const diff = formatScoreDiffTenths(pattern.ratingScoreDiff);
  return (
    <span className="block font-num text-[11px] text-fg-dim">
      {t("Rival.recordLine", { mine, theirs })}
      {diff ? (
        <>
          {" · "}
          <span className={SIGN_TONE[diff.sign]}>{t("Rival.recordScoreDiff", { diff: diff.text })}</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * 요약 카드 아래 결론 문장 카드(2026-11-10, 제목 없음). 첫 줄 `복합 +1.8% 우세 · 삼중 −3.7% 열세`(요약 카드와 같은 평균 달성률 차 기준),
 * 둘째 줄 작은 글자 `총점 차 −226.7 중 삼중이 −222.0이에요. 삼중은 상대가 12곡 더 기록했어요.`
 * 둘째 줄의 속성은 속성별 레이팅 점수 차 절댓값이 가장 큰 속성이고, 뒷문장은 열세 속성에서 상대 기록 수가 더 많을 때만 나온다.
 * 우세·열세가 모두 없고 점수 차도 없으면 카드를 그리지 않는다.
 */
function ConclusionCard({ patterns, totalDiff }: { patterns: readonly RivalPatternSummary[]; totalDiff: number }) {
  const t = useTranslations();
  const { strong, weak, biggest, moreTheirs } = conclusionOf(patterns);
  const first = [
    strong ? t("Rival.conclusionStrong", { pattern: patternLabel(strong.pattern, t), diff: rateDiffText(strong) }) : null,
    weak ? t("Rival.conclusionWeak", { pattern: patternLabel(weak.pattern, t), diff: rateDiffText(weak) }) : null,
  ].filter((x) => x !== null);
  const total = formatScoreDiffTenths(totalDiff);
  const part = biggest ? formatScoreDiffTenths(biggest.ratingScoreDiff) : null;
  const second =
    biggest && total && part
      ? [
          t("Rival.conclusionTotal", { total: total.text, pattern: patternLabel(biggest.pattern, t), diff: part.text }),
          weak && moreTheirs !== null ? t("Rival.conclusionMoreTheirs", { pattern: patternLabel(weak.pattern, t), n: moreTheirs }) : null,
        ]
          .filter((x) => x !== null)
          .join(" ")
      : null;
  if (first.length === 0 && second === null) return null;
  return (
    <div data-testid="rival-conclusion" className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-3">
      {first.length > 0 ? <p className="text-sm font-bold text-fg">{first.join(" · ")}</p> : null}
      {second !== null ? <p className="text-xs leading-4 text-fg-dim">{second}</p> : null}
    </div>
  );
}

/** 작은 승패 막대: 왼쪽 패(주황) · 가운데 무(회색 바탕) · 오른쪽 승(초록). 장식이고 같은 값이 `승 N · 무 N · 패 N` 글자로 있다. */
function MiniBar({ pattern }: { pattern: RivalPatternSummary }) {
  const total = Math.max(pattern.wins + pattern.ties + pattern.losses, 1);
  return (
    <span aria-hidden="true" className="flex h-1.5 w-14 shrink-0 overflow-hidden rounded bg-table-head">
      <span style={{ width: `${(pattern.losses / total) * 100}%` }} className="bg-weak" />
      <span style={{ width: `${(pattern.ties / total) * 100}%` }} />
      <span style={{ width: `${(pattern.wins / total) * 100}%` }} className="bg-done" />
    </span>
  );
}

/** 탭 아래 곡 미리보기: 탭에 든 속성마다 상위 몇 곡을 받아 합쳐 다시 정렬해 보인다. 열세 탭만 `담기`가 있다(4단계와 같은 방식). */
function PreviewList({
  viewerId,
  targetId,
  tab,
  patterns,
  jackets,
}: {
  viewerId: number;
  targetId: number;
  tab: DashTab;
  patterns: readonly RivalPatternSummary[];
  jackets: ReturnType<typeof useJackets>;
}) {
  const t = useTranslations();
  const spec = PREVIEW[tab];
  const results = useQueries({
    queries: patterns.map((p) => ({
      queryKey: dashboardKeys.detail(viewerId, targetId, p.key, spec.filter, spec.sort, 0, spec.count),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchCompareSummaryDetail(targetId, p.key, { filter: spec.filter, sort: spec.sort, page: 0, size: spec.count }, signal),
      retry: false,
    })),
  });
  if (patterns.length === 0) return null;
  if (results.some((r) => r.isPending)) return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  if (results.some((r) => r.isError)) {
    const failed = results.find((r) => r.isError);
    return <p role="alert" className="text-sm text-fg">{failed?.error instanceof ApiError ? failed.error.message : t("Rival.loadFailed")}</p>;
  }
  const rows = mergePreview(results.map((r) => r.data?.rows.content ?? []), tab);
  if (rows.length === 0) return null;
  return (
    <section aria-label={t(`Rival.${PREVIEW_TITLE_KEY[tab]}`)} className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-fg-sub">{t(`Rival.${PREVIEW_TITLE_KEY[tab]}`)}</h3>
      <ul className="overflow-hidden rounded-2xl border border-line bg-card">
        {rows.map((row) => (
          <ChartLine
            key={row.songDifficultyId}
            className="border-t border-row-line first:border-t-0"
            jacket={jackets.visible ? { url: jackets.urlOf(row.songId) } : null}
            pattern={row.pattern}
            tier={row.tier}
            title={row.title}
            href={`/songs/${row.songId}?chart=${row.songDifficultyId}`}
            part={row.part}
            difficulty={row.difficulty}
            level={row.level}
            aside={
              <div className="flex w-[72px] shrink-0 flex-col items-end gap-1.5">
                <RateDiffChip myRate={row.myRate} rate={row.rate} />
                {tab === "weak" ? <SetlistAddCell viewerId={viewerId} songDifficultyId={row.songDifficultyId} title={row.title} /> : null}
              </div>
            }
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * 라이벌 대시보드(D67, 6단계). 비교 화면 맨 위에서 두 사람이 모두 기록한 전체 곡을 속성별로 요약해 보여 준다.
 * 구성: ① 헤더(나·티어 / 총점 차 / 상대·티어, 승 무 패) ② 요약 카드 3(우세 속성·열세 속성·접전, 누르면 아래 탭으로) ③ 차트 전환(막대 · 점 분포 · 레이더, 7단계)
 * ④ `속성별 상세`: 탭(우세·열세·접전) + 속성 줄(누르면 카테고리 상세) + 곡 미리보기.
 * 승·무·패·접전·평균 달성률 차는 서버가 센 값을 그대로 쓰고(화면에서 다시 세지 않는다), 판정 기준은 달성률 차다(D67 개정).
 * 총점은 기존 비교 응답의 값(레이팅 점수)이며 `총점 차`는 그 두 값의 차이라서 승수와 순서가 다를 수 있다(요약 아래 안내 한 줄).
 * 여기의 승·무·패는 전체 곡 기준이라 아래 `곡별 승패`(레이팅 목록 기준)의 개수와 다를 수 있다. 상태(차트·탭)는 주소(`?chart=&tab=`)로 부모가 쥔다.
 */
export function RivalDashboard({
  viewerId,
  targetId,
  rating,
  tab,
  onTabChange,
  chart,
  onChartChange,
  jackets,
}: {
  viewerId: number;
  targetId: number;
  rating: RivalCompareRatingResponse;
  tab: DashTab;
  onTabChange: (tab: DashTab) => void;
  chart: DashChart;
  onChartChange: (chart: DashChart) => void;
  jackets: ReturnType<typeof useJackets>;
}) {
  const t = useTranslations();
  const summary = useQuery({
    queryKey: dashboardKeys.summary(viewerId, targetId),
    queryFn: ({ signal }) => fetchCompareSummary(targetId, signal),
    retry: false,
  });

  if (summary.isPending) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (summary.isError) {
    return <p role="alert" className="text-sm text-fg">{summary.error instanceof ApiError ? summary.error.message : t("Rival.loadFailed")}</p>;
  }
  const { totals, patterns, rateDistribution, closeMargin } = summary.data;
  const inTab = tabPatterns(patterns, tab);
  const totalDiff = Math.round((rating.myTotalScore - rating.totalScore) * 100) / 100;

  function openTab(next: DashTab) {
    onTabChange(next);
    // 카드를 누르면 속성별 상세 구역으로 내려간다(화면 밖일 때만 의미가 있다. 지원하지 않는 환경이면 그대로 둔다)
    document.getElementById(DETAIL_ID)?.scrollIntoView?.({ block: "start" });
  }

  return (
    <section aria-label={t("Rival.dashAria")} className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card p-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-fg-dim">{t("Rival.me")}</span>
          <span data-tier={rating.myTier.key} className="tier-score font-num text-lg font-bold">{formatScore(rating.myTotalScore)}</span>
          <TierChip tier={rating.myTier} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-fg-dim">{t("Rival.totalDiff")}</span>
          <span className="font-num text-lg font-bold text-fg">{signedSum(totalDiff)}</span>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <span className="max-w-full truncate text-xs text-fg-dim">{rating.nickname}</span>
          <span data-tier={rating.tier.key} className="tier-score font-num text-lg font-bold">{formatScore(rating.totalScore)}</span>
          <TierChip tier={rating.tier} />
        </div>
        <p className="col-span-3 font-num text-sm font-bold text-fg">
          {t("Rival.wltLine", { wins: totals.wins, ties: totals.ties, losses: totals.losses })}
        </p>
        <p className="col-span-3 text-[11px] leading-4 text-fg-dim">{t("Rival.judgeNote")}</p>
      </div>

      <div role="group" aria-label={t("Rival.cardsAria")} className="grid grid-cols-3 gap-2">
        {DASH_TABS.map((key) => {
          const top = topPattern(patterns, key);
          return (
            <button
              key={key}
              type="button"
              disabled={top === null}
              aria-pressed={tab === key}
              onClick={() => openTab(key)}
              className={`flex min-h-[76px] min-w-0 flex-col items-start justify-between gap-1 rounded-2xl border bg-card p-2.5 text-left enabled:hover:bg-table-head disabled:text-disabled ${tab === key ? "border-chip-line ring-1 ring-chip-line" : "border-line"}`}
            >
              <span className="text-[11px] leading-4 text-fg-dim">{t(`Rival.${CARD_LABEL_KEY[key]}`)}</span>
              <span className="max-w-full truncate text-sm font-bold text-fg">{top ? patternLabel(top.pattern, t) : "–"}</span>
              <span className="break-keep font-num text-xs font-bold tabular-nums text-fg-sub">
                {top ? (key === "close" ? t("Rival.patternClose", { n: top.closeCount }) : `${t("Rival.rateDiffLabel")} ${rateDiffText(top)}`) : "–"}
              </span>
            </button>
          );
        })}
      </div>

      <ConclusionCard patterns={patterns} totalDiff={totalDiff} />

      <section aria-label={t("Rival.chartAria")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
        <Segment<DashChart> label={t("Rival.chartAria")} items={DASH_CHARTS.map((value) => ({ value, text: t(`Rival.${CHART_LABEL_KEY[value]}`) }))} value={chart} onChange={onChartChange} />
        {chart === "bar" ? (
          <>
            <RivalBarChart patterns={patterns} />
            <p className="text-xs text-fg-dim">{t("Rival.barLegend")}</p>
          </>
        ) : chart === "dot" ? (
          <RivalDotChart patterns={patterns} distribution={rateDistribution} closeMargin={closeMargin} />
        ) : (
          <RivalRadarChart patterns={patterns} />
        )}
      </section>

      <section id={DETAIL_ID} aria-label={t("Rival.detailTitle")} className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="text-sm font-bold text-fg">{t("Rival.detailTitle")}</h2>
        <Segment<DashTab>
          label={t("Rival.detailTitle")}
          items={DASH_TABS.map((key) => ({ value: key, text: t(`Rival.${TAB_LABEL_KEY[key]}`, { n: tabPatterns(patterns, key).length }) }))}
          value={tab}
          onChange={onTabChange}
        />
        {inTab.length === 0 ? (
          <p className="text-sm text-fg-sub">{t("Rival.tabEmpty")}</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line bg-card">
            {inTab.map((p) => (
              <li key={p.key} className="border-t border-row-line first:border-t-0">
                <Link
                  href={`/players/${targetId}/compare/${p.key}?from=${tab}`}
                  className="flex min-h-14 items-center gap-2 px-3 py-2 hover:bg-table-head"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-fg">{patternLabel(p.pattern, t)}</span>
                    <span className="block font-num text-[11px] text-fg-dim">{t("Rival.patternWlt", { wins: p.wins, ties: p.ties, losses: p.losses })}</span>
                    {isSmallSample(p) ? <span className="block text-[11px] text-fg-dim">{t("Rival.smallSample")}</span> : null}
                    <UnplayedLine pattern={p} />
                    <RecordLine pattern={p} />
                  </span>
                  <MiniBar pattern={p} />
                  <PatternValue pattern={p} tab={tab} />
                  <span aria-hidden="true" className="text-fg-dim">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <PreviewList viewerId={viewerId} targetId={targetId} tab={tab} patterns={inTab} jackets={jackets} />
      </section>
    </section>
  );
}
