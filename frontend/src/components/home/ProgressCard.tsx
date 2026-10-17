"use client";

import Link from "next/link";
import { useState } from "react";
import { ProgressDonut } from "@/components/home/ProgressDonut";
import { ProgressTiles } from "@/components/home/ProgressTiles";
import { Skeleton } from "@/components/Skeleton";
import { nextGoal, weakestGroup, type ProgressSummary } from "@/lib/progress";

/** 탭 하나의 데이터 상태. 두 탭을 각자 불러오므로 한쪽이 실패(또는 서열표 없음)해도 다른 탭은 그대로 쓴다. */
export type ProgressPanel =
  | { kind: "ready"; progress: ProgressSummary }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty"; message: string };

type TabKey = "table" | "songs";

const TABS: readonly { key: TabKey; name: string; href: string; link: string; mapLabel: string; mapTitle: string }[] = [
  { key: "table", name: "서열표", href: "/table", link: "서열표 보기", mapLabel: "묶음별 진행", mapTitle: "난이도별 진행" },
  { key: "songs", name: "곡 목록", href: "/songs", link: "곡 목록 보기", mapLabel: "폴더별 진행", mapTitle: "레벨 폴더별 진행" },
];

/**
 * 홈 진행도 카드: `서열표 | 곡 목록` 탭 하나로 전환한다.
 * 위에서부터 도넛(전체 달성 비율), `다음 목표`(SS 이상을 다음 10곡 단위까지), 칸 지도(묶음별 진행),
 * 가장 빈 구간 안내와 `구간 보기` 링크다. 숫자는 모두 서버가 준 개수를 합치거나 비교한 값이다(채보를 화면에서 다시 세지 않는다).
 * 탭은 버튼 둘(aria-pressed)이고 모바일에서 누르기 쉽게 높이를 44px로 둔다.
 */
export function ProgressCard({ table, songs }: { table: ProgressPanel; songs: ProgressPanel }) {
  const [active, setActive] = useState<TabKey>("table");
  const tab = TABS.find((t) => t.key === active) ?? TABS[0];
  const panel = active === "table" ? table : songs;

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="진행도 종류" className="flex gap-1.5 rounded-xl border border-line bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={t.key === active}
            onClick={() => setActive(t.key)}
            className={`min-h-11 flex-1 rounded-[9px] text-sm font-bold ${
              t.key === active ? "bg-chip-on-bg text-chip-on-fg" : "text-fg-sub hover:bg-table-head"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <section aria-label={`${tab.name} 진행도`} className="flex flex-col gap-4 rounded-[14px] border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-num text-[17px] font-bold text-fg">{tab.name} 진행도</h2>
          <Link href={tab.href} className="text-xs text-fg-sub hover:text-fg">
            {tab.link}
          </Link>
        </div>
        <PanelBody panel={panel} tab={tab} />
      </section>
    </div>
  );
}

function PanelBody({ panel, tab }: { panel: ProgressPanel; tab: (typeof TABS)[number] }) {
  if (panel.kind === "loading") {
    return <Skeleton label={`${tab.name} 진행도를 불러오는 중입니다.`} className="h-48" />;
  }
  if (panel.kind === "error") {
    return (
      <p role="alert" className="text-sm text-fg">
        {tab.name} 진행도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }
  if (panel.kind === "empty") {
    return <p className="text-sm text-fg-sub">{panel.message}</p>;
  }

  const { progress } = panel;
  const goal = nextGoal(progress);
  const weak = weakestGroup(progress.groups);
  return (
    <>
      <ProgressDonut progress={progress} />

      {goal ? (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-table-head px-3 py-2.5">
          <span className="shrink-0 rounded-md bg-chip-on-bg px-2 py-0.5 text-[11px] font-bold text-chip-on-fg">다음 목표</span>
          <p className="text-[13px] leading-snug text-fg">
            SS 이상 <b className="font-num">{goal.current}</b>곡 → <b className="font-num">{goal.target}</b>곡까지{" "}
            <b className="font-num">{goal.left}곡</b> 남음
          </p>
        </div>
      ) : null}

      {progress.groups.length > 0 ? (
        <>
          <div className="border-t border-row-line pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[13px] font-bold text-fg-sub">{tab.mapTitle}</h3>
              <span className="text-[11px] text-fg-dim">진한 칸일수록 많이 채움</span>
            </div>
          </div>
          <ProgressTiles groups={progress.groups} label={tab.mapLabel} />
        </>
      ) : null}

      {weak ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-weak bg-weak-tint px-3 py-2.5">
          <p className="text-[13px] leading-snug text-fg">
            <b className="font-num">{weak.group.label}</b> 구간이 가장 비어 있어요. 기록 없는 채보 <b className="font-num">{weak.empty}</b>곡
          </p>
          <Link
            href={weak.group.href}
            className="flex min-h-11 shrink-0 items-center rounded-[10px] border border-chip-line px-3 text-[13px] text-fg hover:bg-table-head"
          >
            구간 보기
          </Link>
        </div>
      ) : null}
    </>
  );
}
