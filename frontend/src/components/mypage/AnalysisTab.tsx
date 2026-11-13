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
  SCALE_TICKS,
  bandLabel,
  fetchWeakness,
  formatAvgDiff,
  hasNoMine,
  patternValue,
  scalePercent,
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
 * 줄 모양(안 1, 두 줄 막대): 줄 제목 + 맨 오른쪽 위 값(평균 달성률 차 `−2.35%`, 부호가 글자) 아래에 막대 두 개 — `나`(내 평균, 초록)와 `같은 티어`(같은 티어 평균, 회색).
 * 막대 눈금은 0~100이 아니라 80~100이고 80 미만은 길이 0이다(차이가 보이게 확대). 각 막대 오른쪽에 값이 둘째 자리까지 글자로 있고 막대 왼쪽에 `나`/`같은 티어` 글자가 있어 색만으로 구분하지 않는다.
 * 맨 위 범례(초록 = 나, 회색 = 같은 티어)와 목록 아래 눈금 숫자·안내가 있다. 약점은 `약점` 글자 표지가 붙는다. 같은 티어 인원이 모자라면 비교 막대의 값은 `–`, 차이는 숨기고 `비교 대상이 적어요`를 보여 준다.
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
        <BarLegend />
      </div>

      <section aria-label={t("Analysis.patternTitle")} className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-fg">{t("Analysis.patternTitle")}</h2>
        <CompareList rows={patternRows} peerAvailable={data.peerAvailable} ariaLabel={t("Analysis.patternTitle")} />
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

/** 막대 한 줄의 가로 배치: `[이름 60px][막대][값 48px]`. 눈금 줄도 같은 여백을 써서 숫자가 막대 칸과 맞는다. */
const BAR_LABEL_W = "w-[60px]";
const BAR_VALUE_W = "w-[48px]";

/** 맨 위 범례. 색 칸은 장식이고 글자(`나`/`같은 티어`)가 의미를 전한다. */
function BarLegend() {
  const t = useTranslations();
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-sub">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-done" />
        {t("Analysis.barMe")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-ctl" />
        {t("Analysis.barPeer")}
      </span>
    </p>
  );
}

function CompareList({ rows, peerAvailable, ariaLabel }: { rows: readonly CompareRowData[]; peerAvailable: boolean; ariaLabel: string }) {
  const t = useTranslations();
  return (
    <>
      <ul aria-label={ariaLabel} className="flex flex-col gap-3">
        {rows.map((row) => (
          <CompareRow key={row.key} row={row} peerAvailable={peerAvailable} />
        ))}
      </ul>
      <ScaleTicks />
      <p className="text-[11px] text-fg-dim">{t("Analysis.scaleNote")}</p>
    </>
  );
}

/** 눈금 숫자 80/85/90/95/100. 막대 칸과 같은 가로 범위에 놓고 양 끝은 칸 밖으로 나가지 않게 붙인다. */
function ScaleTicks() {
  return (
    <div aria-hidden="true" className={`relative ml-[68px] mr-[56px] h-4 font-num text-[11px] text-fg-dim`}>
      {SCALE_TICKS.map((tick, i) => {
        const pos = (i / (SCALE_TICKS.length - 1)) * 100;
        const align = i === 0 ? "" : i === SCALE_TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2";
        return (
          <span key={tick} style={{ left: `${pos}%` }} className={`absolute top-0 ${align}`}>
            {tick}
          </span>
        );
      })}
    </div>
  );
}

/**
 * 한 줄: 제목 + 맨 오른쪽 위 차이, 그 아래 막대 두 개(`나` 초록 / `같은 티어` 회색).
 * 차이 글자는 같은 티어보다 낮으면 주황(`weak-text`), 높으면 초록(`done-text`)이고 부호(`−`/`+`)가 글자로 같이 있다.
 * 막대 도형은 장식(aria-hidden)이고 값은 막대 오른쪽 글자와 아래 글자 줄이 담는다.
 */
function CompareRow({ row, peerAvailable }: { row: CompareRowData; peerAvailable: boolean }) {
  const t = useTranslations();
  const diff = formatAvgDiff(row.diff);
  const diffTone = diff?.sign === "down" ? "text-weak-text" : diff?.sign === "up" ? "text-done-text" : "text-fg";
  return (
    <li data-key={row.key} data-weak={row.weak ? "true" : undefined}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-num text-xs text-fg">{row.label}</span>
        <span className={`shrink-0 text-right font-num text-xs font-bold tabular-nums ${diffTone}`}>
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
      <div className="mt-1 flex flex-col gap-1">
        <BarLine kind="me" name={t("Analysis.barMe")} avg={row.myAvg} fillClass="bg-done" />
        <BarLine kind="peer" name={t("Analysis.barPeer")} avg={row.peerAvg} fillClass="bg-ctl" />
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-fg-dim">
        {row.weak ? (
          <span className="rounded border border-weak px-1 font-bold leading-4 text-weak-text">{t("Analysis.weak")}</span>
        ) : null}
        <span>{lineText(row, peerAvailable, t)}</span>
      </p>
    </li>
  );
}

/** 막대 하나: `이름 | 막대(80~100 눈금) | 값`. 값이 없으면 빈 막대와 `–`. 막대 끝 테두리·세로선은 없다. */
function BarLine({ kind, name, avg, fillClass }: { kind: "me" | "peer"; name: string; avg: number | null; fillClass: string }) {
  return (
    <div data-bar={kind} className="flex items-center gap-2">
      <span className={`${BAR_LABEL_W} shrink-0 whitespace-nowrap text-[11px] text-fg-sub`}>{name}</span>
      <div aria-hidden="true" className="h-3.5 min-w-0 flex-1 overflow-hidden rounded border border-line bg-card">
        <div style={{ width: `${Number(scalePercent(avg).toFixed(2))}%` }} className={`h-full ${fillClass}`} />
      </div>
      <span className={`${BAR_VALUE_W} shrink-0 text-right font-num text-xs tabular-nums text-fg`}>
        {avg === null ? "–" : formatRate(avg)}
      </span>
    </div>
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
