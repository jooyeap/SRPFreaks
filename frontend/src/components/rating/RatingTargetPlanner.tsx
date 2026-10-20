"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState } from "react";
import { Pager, usePaged } from "@/components/Pager";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { ApiError } from "@/lib/api";
import { chartTierAttrs } from "@/lib/chart-tier";
import { allGroupsKey, fetchAllTierGroups, fetchDifficultyTables, pickRatingTable, tableKeys } from "@/lib/difficulty-table";
import { EMPTY_MARK, formatRate, formatScore, formatTier } from "@/lib/format";
import { averageTier, PLAN_VISIBLE_ROWS, planRows, planTargets, visibleWindow, type PlanKind, type PlanRow, type PlanTarget } from "@/lib/rating-target";
import { tableSearchHref } from "@/lib/table-search";
import type { SkillResponse, TierGroupResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/**
 * 레이팅 예상 값 (D31, DESIGN-UI 5장): 내 레이팅 목록의 기준 점수(단일 1·7·15위, 그 외 1·12·25위)를 곡 하나에서 내려면
 * 레이팅 상수 난이도별로 달성률을 얼마나 쳐야 하는지 보여 주고, 난이도를 누르면 그 난이도의 채보 목록을 펼친다.
 * 계산은 서버 값(내 목록 점수)과 서열표 묶음을 화면에서 맞춰 보는 것이라 저장하는 값이 없다 (lib/rating-target.ts).
 * 처음에는 접혀 있다(레이팅 목록이 먼저 보이게).
 */
export function RatingTargetPlanner({ userId, skill }: { userId: number; skill: SkillResponse }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <section aria-label={t("Rating.targetAria")} className="rounded-2xl border border-line bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-[15px] font-bold text-fg">{t("Rating.targetAria")}</span>
          <span className="block text-xs text-fg-sub">{t("Rating.targetLead")}</span>
        </span>
        <span aria-hidden="true" className="text-fg-dim">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {/* 열려 있을 때만 그린다: 서열표 전체를 받는 요청도 이때 처음 보낸다 */}
      {open ? (
        <div id={bodyId} className="border-t border-line px-4 py-3">
          <PlannerBody userId={userId} skill={skill} />
        </div>
      ) : null}
    </section>
  );
}

function PlannerBody({ userId, skill }: { userId: number; skill: SkillResponse }) {
  const t = useTranslations();
  const tables = useQuery({
    queryKey: tableKeys.list,
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    select: pickRatingTable,
  });
  const tableId = tables.data?.id ?? null;
  // 서열표 화면·곡 상세·홈과 같은 키라 이미 받은 묶음을 그대로 쓴다
  const groups = useQuery({
    queryKey: allGroupsKey(userId, tableId ?? 0),
    queryFn: ({ signal }) => fetchAllTierGroups(tableId ?? 0, signal),
    enabled: tableId !== null,
  });

  if (tables.isPending || (tableId !== null && groups.isPending)) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (tables.isError || groups.isError) {
    const error = tables.error ?? groups.error;
    return (
      <p role="alert" className="text-sm text-fg">
        {error instanceof ApiError ? error.message : t("Table.loadFailed")}
      </p>
    );
  }
  if (!groups.data) {
    return <p className="text-sm text-fg-sub">{t("Home.tableEmpty")}</p>;
  }

  const lists: { kind: PlanKind; title: string; targets: PlanTarget[] }[] = [
    { kind: "single", title: t("Chart.patternSingle"), targets: planTargets(skill.single, "single") },
    { kind: "other", title: t("Rating.groupOther"), targets: planTargets(skill.other, "other") },
  ];
  if (lists.every((l) => l.targets.length === 0)) {
    return <p className="text-sm text-fg-sub">{t("Rating.targetEmpty")}</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {lists
        .filter((l) => l.targets.length > 0)
        .map((l) => (
          <PlanList
            key={l.kind}
            title={l.title}
            targets={l.targets}
            rows={planRows(groups.data as TierGroupResponse[], l.kind, l.targets)}
            center={averageTier(l.kind === "single" ? skill.single : skill.other)}
          />
        ))}
      <p className="text-xs leading-relaxed text-fg-dim">
        {t.rich("Rating.targetFootnote", { b: (c) => <b className="text-fg-sub">{c}</b> })}
      </p>
    </div>
  );
}

function PlanList({
  title,
  targets,
  rows: allRows,
  center,
}: {
  title: string;
  targets: PlanTarget[];
  rows: PlanRow[];
  /** 내 목록 채보의 평균 레이팅 상수 난이도. 이 난이도 줄을 가운데로 5줄만 먼저 보인다 */
  center: number | null;
}) {
  const t = useTranslations();
  const [openTier, setOpenTier] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  // 난이도 줄이 많아(5.0~7.0 등 20줄 가까이) 다 보이면 길어서, 내가 치는 레벨대(평균 난이도) 위아래 5줄만 먼저 보이고 나머지는 펼친다
  const rows = showAll ? allRows : visibleWindow(allRows, center);
  const hidden = allRows.length - rows.length;
  // 첫 칸은 난이도, 나머지는 기준 점수마다 한 칸씩
  const columns = { gridTemplateColumns: `3.25rem repeat(${targets.length}, minmax(0, 1fr))` };
  return (
    <section aria-label={t("Rating.targetSectionAria", { title })} className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-fg">{title}</h3>
      <div style={columns} className="grid items-end gap-2 text-center text-[11px] text-fg-dim">
        <span className="text-left">{t("Songs.difficulty")}</span>
        {targets.map((target) => (
          <span key={target.rank} className="flex flex-col items-center gap-0.5">
            <span>{t("Rating.rankScore", { rank: target.rank })}</span>
            {/* 상수표 칸과 같은 색: 이 점수가 상수표의 어느 색 칸인지 바로 맞춰 볼 수 있다 */}
            <span {...chartTierAttrs(target.score)} className="chart-cell font-num w-full rounded-md py-0.5 text-sm font-bold">
              {formatScore(target.score)}
            </span>
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Rating.noTierForScore")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const expanded = openTier === row.tier;
            const panelId = `plan-${title}-${row.tier}`;
            return (
              <li key={row.tier} className="overflow-hidden rounded-xl border border-line bg-page">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={t("Rating.tierRowAria", { tier: formatTier(row.tier, t), count: row.entries.length })}
                  onClick={() => setOpenTier(expanded ? null : row.tier)}
                  style={columns}
                  className="grid w-full items-center gap-2 px-3 py-2 text-center hover:bg-table-head"
                >
                  <span className="text-left font-num text-sm font-bold text-fg">
                    {formatTier(row.tier, t)} <span aria-hidden="true" className="text-xs font-normal text-fg-dim">{expanded ? "▾" : "▸"}</span>
                  </span>
                  {row.needs.map((need, i) => (
                    <span key={targets[i].rank} className={`font-num text-sm ${need === null ? "text-fg-faint" : "text-fg"}`}>
                      {need === null ? t("Rating.impossible") : `${formatRate(need)}%`}
                    </span>
                  ))}
                </button>
                {expanded ? (
                  <TierEntryList id={panelId} label={t("Rating.tierEntriesLabel", { tier: formatTier(row.tier, t) })} entries={row.entries} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {allRows.length > PLAN_VISIBLE_ROWS ? (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
          className="min-h-9 self-center rounded-lg border border-chip-line px-4 text-sm text-fg-sub hover:text-fg"
        >
          {showAll ? t("Rating.nearAvgOnly") : t("Rating.showMore", { count: hidden })}
        </button>
      ) : null}
    </section>
  );
}

/** 한 난이도에 채보가 수십 개일 수 있어 10개씩 나눠 보인다. 난이도 줄을 접으면 이 컴포넌트가 사라져 다음에 열 때 1쪽부터 다시 시작한다. */
export const TIER_ENTRIES_PER_PAGE = 10;

function TierEntryList({ id, label, entries }: { id: string; label: string; entries: PlanRow["entries"] }) {
  const { page, totalPages, pageItems, setPage } = usePaged(entries, TIER_ENTRIES_PER_PAGE);
  return (
    <div className="border-t border-line">
      <ul id={id} aria-label={label} className="flex flex-col">
        {pageItems.map((entry) => (
          <li key={entry.songDifficultyId} className="border-b border-line last:border-b-0">
            <Link href={tableSearchHref(entry)} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-table-head">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{entry.title}</span>
                <span className="mt-1 block">
                  <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                {entry.mine ? (
                  <>
                    <StageBadge stage={entry.mine.stage} />
                    <span className="mt-0.5 block font-num text-xs text-fg-sub">{formatRate(entry.mine.rate)}</span>
                  </>
                ) : (
                  <span className="text-xs text-fg-faint">{EMPTY_MARK}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="py-2">
        <Pager page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
