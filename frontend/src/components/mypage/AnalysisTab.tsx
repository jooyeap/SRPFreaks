"use client";

import { useQuery } from "@tanstack/react-query";
import { AnalysisHelpSheet } from "@/components/mypage/AnalysisHelpSheet";
import { ErrorRetry } from "@/components/ErrorRetry";
import { SetlistAddCell } from "@/components/rivals/SetlistAddCell";
import { Skeleton } from "@/components/Skeleton";
import { ChartLine } from "@/components/table/ChartLine";
import { ApiError } from "@/lib/api";
import { patternLabel } from "@/lib/chart-labels";
import { formatRate, formatScore } from "@/lib/format";
import { useJackets } from "@/lib/jackets";
import {
  avgPercent,
  bandLabel,
  fetchWeakness,
  formatAvgDiff,
  hasNoMine,
  patternValue,
  weaknessKeys,
  type WeaknessAnalysisResponse,
} from "@/lib/weakness";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

/** 막대 한 줄의 재료. 속성 줄과 난이도대 줄이 같은 모양을 쓰도록 공통 모양으로 맞춘다. */
interface CompareRowData {
  key: string;
  label: string;
  charts: number;
  myAvg: number | null;
  peerAvg: number | null;
  peerUsers: number | null;
  diff: number | null;
  weak?: boolean;
}

function errorMessage(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("Analysis.loadFailed");
}

/**
 * 분석 탭(D72): 약점 분석. 내 레이팅 목록과 같은 티어 공개 유저의 레이팅 목록(D53)을 같은 기준에서 속성별 · 난이도대별로 비교한다.
 * 계산은 전부 서버가 한다(`GET /skills/me/weakness`). 이 화면은 값을 그리기만 하고 평균·차이·약점을 다시 계산하지 않는다.
 *
 * 줄 모양은 라이벌 막대(RivalBarChart)와 같다: 라벨 / 막대 / 맨 오른쪽 값(평균 달성률 차 `−2.35%`, 부호가 글자).
 * 막대 길이 = 내 평균 달성률, 세로선 = 같은 티어 평균. 색만으로 전달하지 않는다: 줄 아래에 `내 87.12% · 같은 티어 89.47%(6명)`가 글자로 있고
 * 약점은 `약점` 글자 표지가 붙는다. 같은 티어 인원이 모자라면 비교선과 차이를 숨기고 `비교 대상이 적어요`를 보여 준다.
 * 약점 난이도대 아래에는 올리기 쉬운 곡 3개(현재 → 목표 달성률, 예상 점수 증가)를 공통 줄(ChartLine)로 보여 주고 `담기`는 곡마다 한 개씩(한꺼번에 담기는 없다, D36).
 */
export function AnalysisTab({ userId }: { userId: number }) {
  const t = useTranslations();
  const query = useQuery({
    queryKey: weaknessKeys.me(userId),
    queryFn: ({ signal }) => fetchWeakness(signal),
  });

  if (query.isError) {
    return (
      <ErrorRetry onRetry={() => void query.refetch()} retrying={query.isFetching}>
        {errorMessage(query.error, t)}
      </ErrorRetry>
    );
  }
  if (!query.data) {
    return <Skeleton label={t("Analysis.loading")} className="h-48" />;
  }
  return <AnalysisBody userId={userId} data={query.data} />;
}

function AnalysisBody({ userId, data }: { userId: number; data: WeaknessAnalysisResponse }) {
  const t = useTranslations();

  if (hasNoMine(data)) {
    return <p className="rounded-2xl border border-line bg-card p-4 text-sm text-fg-dim">{t("Analysis.noMine")}</p>;
  }

  const patternRows: CompareRowData[] = data.patterns.map((p) => ({
    key: p.pattern,
    label: patternLabel(patternValue(p.pattern), t),
    charts: p.myCharts,
    myAvg: p.myAvg,
    peerAvg: p.peerAvg,
    peerUsers: p.peerUsers,
    diff: p.diff,
  }));
  const bandRows: CompareRowData[] = data.bands.map((b) => ({
    key: String(b.tierFrom),
    label: bandLabel(b.tierFrom, b.tierTo),
    charts: b.myCharts,
    myAvg: b.myAvg,
    peerAvg: b.peerAvg,
    peerUsers: b.peerUsers,
    diff: b.diff,
    weak: b.weak,
  }));
  const weak = data.bands.find((b) => b.weak) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-fg-dim">{t("Analysis.desc")}</p>
          <AnalysisHelpSheet minCharts={data.minChartsPerBand} minBandUsers={data.minBandUsers} />
        </div>
        {data.peerAvailable ? (
          <p className="mt-1 text-xs text-fg-sub">
            {t("Analysis.peerBasis", { tier: data.tierName ?? "", users: data.bandUsers })}
          </p>
        ) : (
          <p role="status" className="mt-2 rounded-xl border border-line bg-table-head px-3 py-2 text-sm text-fg-sub">
            {t("Analysis.fewPeers")}
          </p>
        )}
      </div>

      <section aria-label={t("Analysis.patternTitle")} className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-fg">{t("Analysis.patternTitle")}</h2>
        <CompareList rows={patternRows} peerAvailable={data.peerAvailable} ariaLabel={t("Analysis.patternTitle")} />
        <p className="text-[11px] text-fg-dim">{t("Analysis.legend")}</p>
      </section>

      <section aria-label={t("Analysis.bandTitle")} className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-fg">{t("Analysis.bandTitle")}</h2>
        <CompareList rows={bandRows} peerAvailable={data.peerAvailable} ariaLabel={t("Analysis.bandTitle")} />
        <p className="text-[11px] text-fg-dim">{t("Analysis.bandNote", { n: data.minChartsPerBand })}</p>
        {data.peerAvailable && weak === null ? <p className="text-xs text-fg-sub">{t("Analysis.noWeak")}</p> : null}
      </section>

      {weak !== null ? (
        <EasySection userId={userId} data={data} range={bandLabel(weak.tierFrom, weak.tierTo)} />
      ) : null}
    </div>
  );
}

function CompareList({ rows, peerAvailable, ariaLabel }: { rows: readonly CompareRowData[]; peerAvailable: boolean; ariaLabel: string }) {
  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-3">
      {rows.map((row) => (
        <CompareRow key={row.key} row={row} peerAvailable={peerAvailable} />
      ))}
    </ul>
  );
}

/**
 * 한 줄: `라벨 | 막대 | 차이`. 막대는 내 평균 달성률만큼 채우고 같은 티어 평균 위치에 세로선을 긋는다. 내 평균보다 같은 티어가 높으면 주황, 아니면 초록(글자 `−`/`+`가 같이 있다). 같은 티어 값이 없어 차이가 없으면 의미 없는 중립색(`ctl`)이다(예전 `table-head`는 카드 배경과 거의 같아 채움이 안 보였다).
 * 도형은 장식이고(aria-hidden) 값은 아래 글자 줄이 모두 담는다.
 */
function CompareRow({ row, peerAvailable }: { row: CompareRowData; peerAvailable: boolean }) {
  const t = useTranslations();
  const diff = formatAvgDiff(row.diff);
  const fillTone =
    diff?.sign === "down" ? "border-weak bg-weak-tint" : diff ? "border-done bg-done-tint" : "border-ctl bg-ctl";
  return (
    <li data-key={row.key} data-weak={row.weak ? "true" : undefined}>
      <div className="flex items-center gap-2">
        <span className="w-[72px] shrink-0 font-num text-xs text-fg">{row.label}</span>
        <div aria-hidden="true" className="relative h-6 min-w-0 flex-1 overflow-hidden rounded border border-line bg-card">
          {row.myAvg !== null ? (
            <div style={{ width: `${avgPercent(row.myAvg)}%` }} className={`h-full border-r ${fillTone}`} />
          ) : null}
          {row.peerAvg !== null ? (
            <span style={{ left: `${avgPercent(row.peerAvg)}%` }} className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-fg" />
          ) : null}
        </div>
        <span className="w-[64px] shrink-0 text-right font-num text-xs font-bold tabular-nums text-fg">
          {diff ? (
            <>
              <span className="sr-only">{t("Analysis.diffLabel")} </span>
              {diff.text}
            </>
          ) : (
            "–"
          )}
        </span>
      </div>
      <p className="ml-[80px] mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-fg-dim">
        {row.weak ? (
          <span className="rounded border border-weak px-1 font-bold leading-4 text-weak-text">{t("Analysis.weak")}</span>
        ) : null}
        <span>{lineText(row, peerAvailable, t)}</span>
      </p>
    </li>
  );
}

function lineText(row: CompareRowData, peerAvailable: boolean, t: Translator): string {
  if (row.myAvg === null) {
    return t("Analysis.notInList");
  }
  const mine = formatRate(row.myAvg);
  if (row.peerAvg === null || row.peerUsers === null) {
    // 같은 티어 인원이 전체로는 충분한데 이 묶음만 모자란 경우도 같은 안내를 쓴다
    return peerAvailable
      ? t("Analysis.lineNoPeer", { mine, charts: row.charts })
      : t("Analysis.lineMine", { mine, charts: row.charts });
  }
  return t("Analysis.linePeer", { mine, peer: formatRate(row.peerAvg), users: row.peerUsers, charts: row.charts });
}

function EasySection({ userId, data, range }: { userId: number; data: WeaknessAnalysisResponse; range: string }) {
  const t = useTranslations();
  const jackets = useJackets();
  if (data.easyCharts.length === 0) {
    return (
      <section aria-label={t("Analysis.easyTitle", { range })} className="flex flex-col gap-1">
        <h2 className="text-sm font-bold text-fg">{t("Analysis.easyTitle", { range })}</h2>
        <p className="text-xs text-fg-dim">{t("Analysis.easyEmpty")}</p>
      </section>
    );
  }
  return (
    <section aria-label={t("Analysis.easyTitle", { range })} className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-bold text-fg">{t("Analysis.easyTitle", { range })}</h2>
        <p className="text-xs text-fg-dim">{t("Analysis.easyDesc")}</p>
      </div>
      <ul aria-label={t("Analysis.easyTitle", { range })} className="overflow-hidden rounded-2xl border border-line bg-card">
        {data.easyCharts.map((c) => (
          <ChartLine
            key={c.songDifficultyId}
            className="border-t border-row-line first:border-t-0"
            jacket={jackets.visible ? { url: jackets.urlOf(c.songId) } : null}
            pattern={c.pattern}
            tier={c.tier}
            title={c.title}
            href={`/songs/${c.songId}?chart=${c.songDifficultyId}`}
            part={c.part}
            difficulty={c.difficulty}
            level={c.level}
            // 오른쪽: 현재 → 목표 달성률 / 예상 점수 증가 / `담기`(한 곡씩). 부호와 글자가 있어 색 없이도 읽힌다
            aside={
              <div className="flex w-[88px] shrink-0 flex-col items-end gap-1">
                <span className="whitespace-nowrap font-num text-[11px] text-fg-sub">
                  <span className="sr-only">{t("Analysis.rateFromTo")} </span>
                  {formatRate(c.currentRate)} → {formatRate(c.targetRate)}
                </span>
                <span className="whitespace-nowrap font-num text-[11px] font-bold text-done-text">
                  {t("Analysis.gain", { gain: formatScore(c.expectedGain) })}
                </span>
                <SetlistAddCell viewerId={userId} songDifficultyId={c.songDifficultyId} title={c.title} />
              </div>
            }
          />
        ))}
      </ul>
    </section>
  );
}
