"use client";

import Link from "next/link";
import { folderHref } from "@/lib/difficulty-table";
import type { FolderNeighbors } from "@/lib/folder-nav";
import { formatTier } from "@/lib/format";
import type { TierGroupResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/**
 * 폴더 화면 맨 아래의 이웃 난이도 버튼 두 개: `‹ 5.7 5/18`(바로 아래 난이도) · `5.9 6/30 ›`(바로 위 난이도).
 * 하단 탭바 바로 위에 고정해서(--tabbar-h, 넓은 화면은 0) 항상 보이고 탭바와 겹치지 않는다. 첫/마지막 난이도에서는 없는 쪽을 흐린 자리 표시로 둔다(막대 폭이 흔들리지 않게).
 * n/전체는 폴더 머리와 같은 규칙(같은 필터)으로 센 값이다. 이동은 replace(뒤로 가기 한 번이 서열표).
 * 터치 영역은 높이 44px.
 */
export function FolderNeighborBar({ neighbors }: { neighbors: FolderNeighbors }) {
  const t = useTranslations();
  return (
    <nav aria-label={t("Table.neighborTiers")} className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 border-t border-line bg-card">
      {/* 넓은 화면의 왼쪽 아래에는 곡 검색 둥근 버튼(SearchFocusButton)이 떠 있어서 그만큼 비워 둔다 */}
      <div className="mx-auto flex w-full max-w-[1200px] items-stretch justify-between gap-2 px-4 py-2 lg:pl-20">
        <Step group={neighbors.lower} direction="prev" />
        <Step group={neighbors.higher} direction="next" />
      </div>
    </nav>
  );
}

function Step({ group, direction }: { group: TierGroupResponse | null; direction: "prev" | "next" }) {
  const t = useTranslations();
  const arrow = direction === "prev" ? "‹" : "›";
  const base = "flex min-h-11 flex-1 items-center gap-2 rounded-xl border px-3 sm:max-w-xs";
  const align = direction === "prev" ? "justify-start" : "justify-end";
  if (!group) {
    return (
      <span aria-hidden="true" className={`${base} ${align} ${direction === "next" ? "ml-auto" : ""} border-line text-disabled`}>
        <span className="text-lg leading-none">{arrow}</span>
      </span>
    );
  }
  const label = formatTier(group.tier, t);
  const arrowEl = <span aria-hidden="true" className="text-lg leading-none text-fg-sub">{arrow}</span>;
  const text = (
    <span className="flex items-baseline gap-1.5">
      <span className="font-num text-sm font-bold text-fg">{label}</span>
      <span className="font-num text-xs text-fg-dim">
        {group.recorded}/{group.total}
      </span>
    </span>
  );
  return (
    <Link
      href={folderHref(group.tier)}
      replace
      aria-label={`${t("Chart.nav", { direction: direction === "prev" ? t("Common.prev") : t("Common.next"), label })} ${t("Chart.recordedOf", { recorded: group.recorded, total: group.total })}`}
      className={`${base} ${align} border-ctl hover:bg-table-head ${direction === "next" ? "ml-auto" : ""}`}
    >
      {direction === "prev" ? arrowEl : null}
      {text}
      {direction === "next" ? arrowEl : null}
    </Link>
  );
}
