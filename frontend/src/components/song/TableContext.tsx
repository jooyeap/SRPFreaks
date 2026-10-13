"use client";

import Link from "next/link";
import { useEffect, useRef, type RefObject } from "react";
// import { SongJacket } from "@/components/SongJacket"; // 재킷 칸 숨김 (아래 주석 참고)
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { EMPTY_MARK, formatLevel, formatTier } from "@/lib/format";
import type { TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { folderHref } from "@/lib/difficulty-table";

/** 서열표에서 들어온 곡 상세 주소. */
export function tableDetailHref(entry: Pick<TableEntryResponse, "songId" | "songDifficultyId">): string {
  return `/songs/${entry.songId}?from=table&chart=${entry.songDifficultyId}`;
}

/**
 * 서열표 정보 카드: 기준 난이도 · 추천 · 레벨, 그 아래 `5.3 묶음 48개 · 내 평균 91.20%`와 묶음 안의 EXC/FC/SS/S 개수.
 * 숫자는 서열표 화면의 묶음 통계와 같은 값(서버 계산)이다. 평균은 기록이 있는 채보만의 평균(`0% 미포함`)이다.
 */
export function TableInfoCard({ group, entry }: { group: TierGroupResponse; entry: TableEntryResponse }) {
  const average = group.averageRecorded === null ? EMPTY_MARK : `${group.averageRecorded.toFixed(2)}%`;
  const counts = [
    { label: "EXC", stage: "EXC", count: group.exc },
    { label: "FC", stage: "FC", count: group.fc },
    { label: "SS", stage: "SS", count: group.ss },
    { label: "S", stage: "S", count: group.s },
  ] as const;
  return (
    <section aria-label="서열표 정보" className="flex flex-col gap-3 rounded-[14px] border border-line bg-card px-4 py-3.5">
      <h2 className="sr-only">서열표 정보</h2>
      <dl className="grid grid-cols-3 gap-2.5 text-sm">
        <div>
          <dt className="text-xs text-fg-dim">레이팅 상수 난이도</dt>
          <dd className="font-num text-[22px] font-bold leading-tight text-fg">
            {formatTier(group.tier)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-dim">추천</dt>
          <dd>
            {entry.recommend ? (
              <RecommendBadge value={entry.recommend} />
            ) : (
              <span className="text-fg-faint">{EMPTY_MARK}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-dim">레벨</dt>
          <dd className="font-num text-[22px] font-bold leading-tight text-fg">{formatLevel(entry.level)}</dd>
        </div>
      </dl>
      <p className="border-t border-row-line pt-2.5 text-xs text-fg-dim">
        <span className="font-num text-fg">{formatTier(group.tier)}</span> 묶음 {group.total}개 · 내 평균{" "}
        <span className="font-num text-fg">{average}</span>
      </p>
      <ul className="flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="묶음 안의 내 달성 현황">
        {counts.map((c) => (
          <li key={c.label} className={c.count === 0 ? "opacity-60" : undefined}>
            {/* 단계 배지는 글자(EXC/FC/SS/S)가 같이 있으므로 색만으로 구분하지 않는다 */}
            <StageBadge stage={c.stage} /> <span className="font-num text-fg-sub">{c.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `이 곡의 다른 채보 n개` 접힘 줄. 누르면 다른 채보로 바꿔 볼 수 있다. */
export function OtherCharts({ charts }: { charts: readonly TableEntryResponse[] }) {
  if (charts.length === 0) {
    return null;
  }
  return (
    <details className="rounded-lg border border-line bg-card px-4 py-3">
      <summary className="cursor-pointer text-sm text-fg-sub">이 곡의 다른 채보 {charts.length}개</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {charts.map((c) => (
          <li key={c.songDifficultyId}>
            <Link
              replace
              href={tableDetailHref(c)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-fg hover:bg-table-head"
            >
              <ChartBadge part={c.part} difficulty={c.difficulty} level={c.level} />
              <span className="ml-auto">{c.mine ? <StageBadge stage={c.mine.stage} /> : <span className="text-xs text-fg-faint">기록 없음</span>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * 같은 난이도의 곡: 묶음 안의 모든 채보를 서열표 순서(레벨 높은 순)로 보여 준다. 눌러서 이동한다.
 * 지금 보는 채보는 강조하고(aria-current) 목록이 길면(48개 등) 목록 안에서만 스크롤하며, 열릴 때 현재 채보 위치로 맞춘다.
 * 아래 링크로 묶음 페이지(/table/folder/…)에서 묶음 전체를 크게 볼 수 있다.
 */
export function GroupSongList({ group, index }: { group: TierGroupResponse; index: number }) {
  const listRef = useRef<HTMLUListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);

  // 현재 채보가 목록 가운데쯤 오게 스크롤한다. 페이지 전체가 아니라 목록 상자만 움직이려고 scrollTop을 직접 쓴다
  // (scrollIntoView는 페이지 스크롤까지 건드린다).
  useEffect(() => {
    const list = listRef.current;
    const current = currentRef.current;
    if (list && current) {
      list.scrollTop = Math.max(current.offsetTop - list.clientHeight / 2 + current.clientHeight / 2, 0);
    }
  }, [group, index]);

  return (
    <section aria-label="같은 난이도의 곡" className="flex flex-col gap-2">
      <h2 className="flex items-baseline justify-between px-1 font-num text-[17px] font-bold text-fg">
        <span>
          같은 난이도의 곡 <span className="font-sans text-xs font-normal text-fg-dim">{group.entries.length}개</span>
        </span>
        {/* 미정 묶음은 서열표 화면에서 뺐으므로 갈 곳이 없다 */}
        {group.tier !== null ? (
          <Link href={folderHref(group.tier)} className="font-sans text-xs font-normal text-fg-sub hover:text-fg">
            묶음 전체 보기
          </Link>
        ) : null}
      </h2>
      <ul ref={listRef} className="relative max-h-[22rem] overflow-y-auto rounded-[14px] border border-line bg-card">
        {group.entries.map((entry, i) => (
          <GroupSongItem key={entry.entryId} entry={entry} current={i === index} itemRef={i === index ? currentRef : undefined} />
        ))}
      </ul>
    </section>
  );
}

function GroupSongItem({
  entry,
  current,
  itemRef,
}: {
  entry: TableEntryResponse;
  current: boolean;
  itemRef?: RefObject<HTMLLIElement | null>;
}) {
  return (
    <li ref={itemRef} aria-current={current ? "true" : undefined} className="border-t border-row-line first:border-t-0">
      <Link
        replace
        href={tableDetailHref(entry)}
        className={`flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-table-head ${current ? "bg-table-head" : ""}`}
      >
        {/* 재킷 칸은 저작권(이미지 사용 허락) 문제가 정리될 때까지 숨긴다. 복원할 때 이 줄과 위의 import 주석을 되살린다. */}
        {/* <SongJacket className="h-8 w-8 rounded-[7px]" /> */}
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${current ? "font-bold text-fg" : "text-fg"}`}>
            {entry.title}
            {/* 색만으로 구분하지 않도록 현재 곡에는 글자 표시를 같이 둔다 */}
            {current ? <span className="ml-1.5 text-[11px] font-normal text-fg-dim">보는 중</span> : null}
          </span>
          <span className="mt-0.5 block">
            <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
          </span>
        </span>
        {entry.mine ? <StageBadge stage={entry.mine.stage} /> : <span className="text-[11px] text-fg-faint">기록 없음</span>}
      </Link>
    </li>
  );
}
