"use client";

import Link from "next/link";
import { useState } from "react";
import { ProgressDonut } from "@/components/home/ProgressDonut";
import { ProgressTiles } from "@/components/home/ProgressTiles";
import { Skeleton } from "@/components/Skeleton";
import { nextGoal, weakestGroup, weakestGroupNear, type ProgressSummary } from "@/lib/progress";
import { useTranslations } from "next-intl";

/** 탭 하나의 데이터 상태. 두 탭을 각자 불러오므로 한쪽이 실패(또는 서열표 없음)해도 다른 탭은 그대로 쓴다. */
export type ProgressPanel =
  | { kind: "ready"; progress: ProgressSummary }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty"; message: string };

type TabKey = "table" | "songs";

/** 탭 하나의 글자는 messages의 Progress 아래 키다(탭마다 이름·링크·칸 지도 제목·접근성 이름) */
const TABS = [
  { key: "table", href: "/table", name: "tableName", link: "tableLink", mapLabel: "tableMapLabel", mapTitle: "tableMapTitle" },
  { key: "songs", href: "/songs", name: "songsName", link: "songsLink", mapLabel: "songsMapLabel", mapTitle: "songsMapTitle" },
] as const;

/** 번역을 마친 탭 글자 */
interface TabText {
  name: string;
  href: string;
  link: string;
  mapLabel: string;
  mapTitle: string;
}

/**
 * 홈 진행도 카드: `서열표 | 곡 목록` 탭 하나로 전환한다.
 * 위에서부터 도넛(전체 달성 비율), `다음 목표`(SS 이상을 다음 10곡 단위까지), 칸 지도(묶음별 진행),
 * 가장 빈 구간 안내와 `구간 보기` 링크다. 숫자는 모두 서버가 준 개수를 합치거나 비교한 값이다(채보를 화면에서 다시 세지 않는다).
 * 탭은 버튼 둘(aria-pressed)이고 모바일에서 누르기 쉽게 높이를 44px로 둔다.
 */
export function ProgressCard({
  table,
  songs,
  average = null,
}: {
  table: ProgressPanel;
  songs: ProgressPanel;
  /** 내 평균 난이도(서열표 기준). 있으면 서열표 탭의 `가장 비어 있는 구간`을 이 값 ±0.2 안으로 좁힌다. 곡 목록 탭은 단위(레벨 폴더)가 달라 그대로다 */
  average?: number | null;
}) {
  const t = useTranslations("Progress");
  const [active, setActive] = useState<TabKey>("table");
  const base = TABS.find((candidate) => candidate.key === active) ?? TABS[0];
  const tab: TabText = { href: base.href, name: t(base.name), link: t(base.link), mapLabel: t(base.mapLabel), mapTitle: t(base.mapTitle) };
  const panel = active === "table" ? table : songs;

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t("kindAria")} className="flex gap-1.5 rounded-2xl border border-line bg-card p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.key === active}
            onClick={() => setActive(item.key)}
            className={`min-h-11 flex-1 rounded-[9px] text-sm font-bold ${
              item.key === active ? "bg-chip-on-bg text-chip-on-fg" : "text-fg-sub hover:bg-table-head"
            }`}
          >
            {t(item.name)}
          </button>
        ))}
      </div>

      <section aria-label={t("sectionAria", { name: tab.name })} className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-num text-[17px] font-bold text-fg">{t("sectionAria", { name: tab.name })}</h2>
          <Link href={tab.href} className="text-xs text-fg-sub hover:text-fg">
            {tab.link}
          </Link>
        </div>
        <PanelBody panel={panel} tab={tab} average={active === "table" ? average : null} />
      </section>
    </div>
  );
}

function PanelBody({ panel, tab, average }: { panel: ProgressPanel; tab: TabText; average: number | null }) {
  const t = useTranslations("Progress");
  if (panel.kind === "loading") {
    return <Skeleton label={t("loading", { name: tab.name })} className="h-48" />;
  }
  if (panel.kind === "error") {
    return (
      <p role="alert" className="text-sm text-fg">
        {t("loadFailed", { name: tab.name })}
      </p>
    );
  }
  if (panel.kind === "empty") {
    return <p className="text-sm text-fg-sub">{panel.message}</p>;
  }

  const { progress } = panel;
  const goal = nextGoal(progress);
  const weak = average !== null ? weakestGroupNear(progress.groups, average) : weakestGroup(progress.groups);
  return (
    <>
      <ProgressDonut progress={progress} />

      {goal ? (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-table-head px-3 py-2.5">
          <span className="shrink-0 rounded-md bg-chip-on-bg px-2 py-0.5 text-[11px] font-bold text-chip-on-fg">{t("nextGoal")}</span>
          <p className="break-keep text-[13px] leading-snug text-fg">
            {t.rich("goalText", { current: goal.current, target: goal.target, left: goal.left, b: (chunks) => <b className="font-num">{chunks}</b> })}
          </p>
        </div>
      ) : null}

      {progress.groups.length > 0 ? (
        <>
          <div className="border-t border-row-line pt-3">
            <h3 className="text-[13px] font-bold text-fg-sub">{tab.mapTitle}</h3>
          </div>
          <ProgressTiles groups={progress.groups} label={tab.mapLabel} />
        </>
      ) : null}

      {weak ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-weak bg-weak-tint px-3 py-2.5">
          <p className="break-keep text-[13px] leading-snug text-fg">
            {average !== null
              ? t.rich("weakNearText", { average: average.toFixed(1), label: weak.group.label, empty: weak.empty, b: (chunks) => <b className="font-num">{chunks}</b> })
              : t.rich("weakText", { label: weak.group.label, empty: weak.empty, b: (chunks) => <b className="font-num">{chunks}</b> })}
          </p>
          <Link
            href={weak.group.href}
            className="flex min-h-11 shrink-0 items-center rounded-[10px] border border-chip-line px-3 text-[13px] text-fg hover:bg-table-head"
          >
            {t("viewRange")}
          </Link>
        </div>
      ) : null}
    </>
  );
}
