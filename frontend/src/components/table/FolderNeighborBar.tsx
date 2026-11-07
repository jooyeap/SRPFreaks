"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { folderHref } from "@/lib/difficulty-table";
import { folderProgressPercent, type FolderNeighbors } from "@/lib/folder-nav";
import { formatTier } from "@/lib/format";
import type { TierGroupResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/** 바 전체 높이: 구분선 1px + 위 여백 10px + 알약 48px + 아래 여백 8px = 67px. 토스트·본문 여백이 이 값을 쓴다(--bottom-bar-h) */
export const FOLDER_BAR_HEIGHT = "67px";

/**
 * 폴더 화면 맨 아래의 이웃 난이도 이동 바(알약 스테퍼, 2026-11-07).
 * 높이 48px 알약 하나: [‹ 아이콘 + 이전 난이도] [지금 난이도 / 진행 막대 / n/전체] [다음 난이도 + 아이콘 ›].
 * 클릭 영역은 아이콘만이 아니라 알약의 왼쪽 끝~가운데 라벨 앞(이전), 가운데 라벨 뒤~오른쪽 끝(다음) 구역 전체다.
 * 구역 하나가 button 하나이고 안의 원형 아이콘은 장식이다(버튼을 중첩하지 않는다). 눌림 배경·포커스 링도 구역 전체에 그린다.
 * 맨 끝 난이도에서는 없는 쪽 구역을 숨기되(aria-hidden + inert) 자리는 남긴다: 그리드 `1fr auto 1fr`라 가운데 라벨이 항상 정중앙이다.
 * 하단 탭바 바로 위에 고정한다(--tabbar-h, 넓은 화면은 0). 이동은 replace(뒤로 가기 한 번이 서열표).
 * 가운데의 n/전체는 폴더 머리와 같은 값(같은 필터로 센 값)을 부모가 넘긴다.
 */
export function FolderNeighborBar({
  neighbors,
  tier,
  recorded,
  total,
}: {
  neighbors: FolderNeighbors;
  /** 지금 보는 난이도(미정이면 null) */
  tier: number | null;
  recorded: number;
  total: number;
}) {
  const t = useTranslations();

  // 토스트가 이 바에 가려지지 않게 바 높이를 알린다(곡 상세 바와 같은 방식, Toast.tsx가 --bottom-bar-h를 읽는다)
  useEffect(() => {
    document.documentElement.style.setProperty("--bottom-bar-h", FOLDER_BAR_HEIGHT);
    return () => {
      document.documentElement.style.removeProperty("--bottom-bar-h");
    };
  }, []);

  return (
    <nav aria-label={t("Table.neighborTiers")} className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 border-t border-line bg-card pt-[10px] pb-2">
      {/* 넓은 화면의 왼쪽 아래에는 곡 검색 둥근 버튼(SearchFocusButton)이 떠 있어서 그만큼 비워 둔다 */}
      <div className="mx-auto w-full max-w-[1200px] px-4 lg:pl-20">
        <div
          data-testid="folder-pill"
          className="mx-auto grid h-12 max-w-md grid-cols-[1fr_auto_1fr] items-stretch rounded-3xl border border-ctl bg-card p-1"
        >
          <Zone group={neighbors.lower} direction="prev" />
          <div data-testid="folder-pill-center" className="pointer-events-none flex flex-col items-center justify-center px-2">
            <span className="font-num text-[15px] font-bold leading-tight text-fg">{formatTier(tier, t)}</span>
            <span aria-hidden="true" data-testid="folder-pill-bar" className="my-0.5 block h-[3px] w-16 overflow-hidden rounded-full bg-line">
              <span
                data-testid="folder-pill-fill"
                className="block h-full bg-[var(--stage-ss-bar)]"
                style={{ width: `${folderProgressPercent(recorded, total)}%` }}
              />
            </span>
            <span className="font-num text-[9px] leading-tight text-fg-dim">
              {recorded}/{total}
            </span>
          </div>
          <Zone group={neighbors.higher} direction="next" />
        </div>
      </div>
    </nav>
  );
}

function Zone({ group, direction }: { group: TierGroupResponse | null; direction: "prev" | "next" }) {
  const t = useTranslations();
  const router = useRouter();
  const prev = direction === "prev";
  // 바깥쪽 모서리는 알약 안쪽 반지름(24px - 여백 4px = 20px), 가운데 쪽은 작게
  const shape = prev ? "rounded-l-[20px] rounded-r-lg" : "rounded-l-lg rounded-r-[20px]";
  if (!group) {
    // 자리만 남긴다: 보이지 않고, 탭 순서와 접근성 트리에서도 빠진다
    return <div aria-hidden="true" inert data-testid={`folder-pill-${direction}-empty`} className="invisible" />;
  }
  const label = formatTier(group.tier, t);
  const icon = (
    <span aria-hidden="true" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-line bg-table-head text-fg-sub">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={prev ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
      </svg>
    </span>
  );
  const number = <span className="font-num text-[13px] font-bold tabular-nums text-fg-sub">{label}</span>;
  return (
    <button
      type="button"
      data-testid={`folder-pill-${direction}`}
      aria-label={t(prev ? "Table.neighborPrevTier" : "Table.neighborNextTier", { tier: label })}
      onClick={() => router.replace(folderHref(group.tier))}
      className={`folder-pill-zone flex h-full min-w-0 items-center gap-2 ${shape} ${prev ? "justify-start pl-0 pr-2" : "justify-end pl-2 pr-0"} hover:bg-table-head active:bg-table-head`}
    >
      {prev ? icon : null}
      {number}
      {prev ? null : icon}
    </button>
  );
}
