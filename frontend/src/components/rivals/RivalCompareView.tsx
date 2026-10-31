"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";
import { Pager } from "@/components/Pager";
import { ApiError } from "@/lib/api";
import type { PlayerTierResponse, RivalChartRow, RivalCounts, RivalRatingRow, RivalResult } from "@/lib/api-types";
import { difficultyLabel, formatLevel, formatRate, formatScore, partLabel } from "@/lib/format";
import { fetchCompareCharts, fetchCompareRating, formatDiff, rivalKeys, signed } from "@/lib/rivals";
import { useTranslations } from "next-intl";

type View = "rating" | "charts";
type Group = "single" | "other";

const RESULTS: readonly { value: RivalResult; key: "resultWin" | "resultLose" | "resultTie" | "resultTheirs"; count: keyof RivalCounts }[] = [
  { value: "WIN", key: "resultWin", count: "win" },
  { value: "LOSE", key: "resultLose", count: "lose" },
  { value: "TIE", key: "resultTie", count: "tie" },
  { value: "THEIRS_ONLY", key: "resultTheirs", count: "theirsOnly" },
];

/** 둘 중 하나만 고르는 작은 전환(레이팅 목록 / 곡별 승패 같은). 선택은 굵은 글씨·테두리로도 보인다. */
function Segment<T extends string>({ label, items, value, onChange }: {
  label: string;
  items: readonly { value: T; text: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl border border-line bg-table-head p-1">
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(item.value)}
            className={`min-h-10 flex-1 rounded-lg px-2 text-sm ${on ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-sub hover:text-fg"}`}
          >
            {item.text}
          </button>
        );
      })}
    </div>
  );
}

function TierChip({ tier }: { tier: PlayerTierResponse }) {
  return (
    <span data-tier={tier.key} className="tier-chip inline-block rounded-full px-2 py-0.5 text-[11px] font-bold">
      {tier.displayName}
    </span>
  );
}

function ChartPill({ part, difficulty, level }: { part: RivalRatingRow["part"]; difficulty: RivalRatingRow["difficulty"]; level: number }) {
  return (
    <span className="font-num inline-flex shrink-0 items-center gap-1 rounded-md border border-chip-line px-1.5 text-[11px] font-semibold text-fg-sub">
      {partLabel(part)} | {difficultyLabel(difficulty)} {formatLevel(level)}
    </span>
  );
}

/**
 * 라이벌 비교 화면(D56). 머리: 나 총점 · 승·패·같음 · 상대 총점. 보기: 상대 레이팅 목록에 내 점수 나란히 / 곡별 승패.
 * 승패·점수는 서버가 계산한 값을 그대로 쓴다(화면에서 다시 계산하지 않는다).
 */
export function RivalCompareView({ viewerId, targetId, initialView = "rating" }: { viewerId: number; targetId: number; initialView?: View }) {
  const t = useTranslations("Rival");
  const tc = useTranslations();
  const [view, setView] = useState<View>(initialView);
  const [group, setGroup] = useState<Group>("single");
  const [result, setResult] = useState<RivalResult>("LOSE");
  const [page, setPage] = useState(0);

  const rating = useQuery({
    queryKey: rivalKeys.rating(viewerId, targetId),
    queryFn: ({ signal }) => fetchCompareRating(targetId, signal),
    retry: false,
  });
  const charts = useQuery({
    queryKey: [...rivalKeys.charts(viewerId, targetId, result), page],
    queryFn: ({ signal }) => fetchCompareCharts(targetId, result, page, signal),
    enabled: view === "charts" && rating.isSuccess,
    retry: false,
  });

  const back = (
    <Link href={`/players/${targetId}`} aria-label={t("backAria")} title={t("backAria")} className={BACK_BUTTON_CLASS}>
      <BackArrow />
    </Link>
  );

  if (rating.isPending) {
    return <p className="text-sm text-fg-sub">{tc("Common.loading")}</p>;
  }
  if (rating.isError) {
    const notFound = rating.error instanceof ApiError && rating.error.status === 404;
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p role="alert" className="text-sm text-fg">
          {notFound ? tc("Players.notFound") : rating.error instanceof ApiError ? rating.error.message : t("loadFailed")}
        </p>
      </div>
    );
  }
  const data = rating.data;
  const counts = data.counts;
  const rows = group === "single" ? data.single : data.other;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {back}
        <h1 className="min-w-0 truncate text-xl font-semibold text-fg">{t("vsTitle", { nickname: data.nickname })}</h1>
      </div>

      <section aria-label={t("summaryAria")} className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card p-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-fg-dim">{t("me")}</span>
          <span data-tier={data.myTier.key} className="tier-score font-num text-lg font-bold">{formatScore(data.myTotalScore)}</span>
          <TierChip tier={data.myTier} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-fg-dim">{t("wlt")}</span>
          <span className="font-num text-lg font-bold text-fg">
            {counts.win} · {counts.lose} · {counts.tie}
          </span>
          <span className="text-xs text-fg-dim">{t("theirsOnlyLine", { n: counts.theirsOnly })}</span>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <span className="max-w-full truncate text-xs text-fg-dim">{data.nickname}</span>
          <span data-tier={data.tier.key} className="tier-score font-num text-lg font-bold">{formatScore(data.totalScore)}</span>
          <TierChip tier={data.tier} />
        </div>
      </section>

      <Segment<View>
        label={t("viewAria")}
        items={[{ value: "rating", text: t("viewRating") }, { value: "charts", text: t("viewCharts") }]}
        value={view}
        onChange={setView}
      />

      {view === "rating" ? (
        <section aria-label={t("viewRating")} className="flex flex-col gap-3">
          <Segment<Group>
            label={t("groupAria")}
            items={[{ value: "single", text: t("groupSingle") }, { value: "other", text: t("groupOther") }]}
            value={group}
            onChange={setGroup}
          />
          {rows.length === 0 ? (
            <p className="text-sm text-fg-sub">{t("emptyRating")}</p>
          ) : (
            <ol className="rounded-2xl border border-line bg-card">
              {rows.map((row) => {
                const diff = formatDiff(row.diff);
                return (
                  <li key={row.songDifficultyId} className="border-t border-row-line first:border-t-0">
                    <Link href={`/songs/${row.songId}?chart=${row.songDifficultyId}`} className="grid grid-cols-[24px_minmax(0,1fr)_auto_56px] items-center gap-2 px-3 py-2.5 hover:bg-table-head">
                      <span className="font-num text-xs text-fg-dim">{row.rank}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-fg">{row.title}</span>
                        <span className="mt-0.5 flex"><ChartPill part={row.part} difficulty={row.difficulty} level={row.level} /></span>
                      </span>
                      <span className="text-right">
                        <span className="block font-num text-[13px] text-fg">{formatScore(row.score)}</span>
                        <span className="block font-num text-[11px] text-fg-dim">{formatRate(row.rate)}%</span>
                      </span>
                      <span className={`text-right font-num text-xs ${diff?.sign === "up" ? "text-done-text" : diff?.sign === "down" ? "text-danger" : "text-fg-dim"}`}>
                        {diff ? diff.text : t("noRecord")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-xs text-fg-dim">{t("ratingLegend", { nickname: data.nickname })}</p>
        </section>
      ) : (
        <section aria-label={t("viewCharts")} className="flex flex-col gap-3">
          <Segment<RivalResult>
            label={t("resultAria")}
            items={RESULTS.map((r) => ({ value: r.value, text: t(r.key, { n: counts[r.count] }) }))}
            value={result}
            onChange={(next) => {
              setResult(next);
              setPage(0);
            }}
          />
          <p className="text-xs text-fg-dim">{t("chartsOrder")}</p>
          {charts.isPending ? (
            <p className="text-sm text-fg-sub">{tc("Common.loading")}</p>
          ) : charts.isError ? (
            <p role="alert" className="text-sm text-fg">{charts.error instanceof ApiError ? charts.error.message : t("loadFailed")}</p>
          ) : charts.data.page.content.length === 0 ? (
            <p className="text-sm text-fg-sub">{t("emptyCharts")}</p>
          ) : (
            <>
              <ul className="rounded-2xl border border-line bg-card">
                {charts.data.page.content.map((row: RivalChartRow) => (
                  <li key={row.songDifficultyId} className="border-t border-row-line first:border-t-0">
                    <Link href={`/songs/${row.songId}?chart=${row.songDifficultyId}`} className="grid grid-cols-[minmax(0,1fr)_auto_56px] items-center gap-2 px-3 py-2.5 hover:bg-table-head">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-fg">{row.title}</span>
                        <span className="mt-0.5 flex"><ChartPill part={row.part} difficulty={row.difficulty} level={row.level} /></span>
                      </span>
                      <span className="text-right font-num text-xs">
                        <span className="block text-fg" aria-label={t("myRateAria")}>{formatRate(row.myRate)}</span>
                        <span className="block text-fg-dim" aria-label={t("theirRateAria", { nickname: data.nickname })}>{formatRate(row.theirRate)}</span>
                      </span>
                      <span className={`text-right font-num text-xs ${row.diff !== null && row.diff > 0 ? "text-done-text" : row.diff !== null && row.diff < 0 ? "text-danger" : "text-fg-dim"}`}>
                        {row.diff === null ? "–" : signed(row.diff)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pager page={page} totalPages={charts.data.page.totalPages} onChange={setPage} />
            </>
          )}
          <p className="text-xs text-fg-dim">{t("chartsLegend", { nickname: data.nickname })}</p>
        </section>
      )}
    </div>
  );
}
