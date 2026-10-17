"use client";

import Link from "next/link";
import { useState } from "react";
import { StageBar } from "@/components/table/StageBar";
import { chipsOf, groupStage } from "@/components/table/TierGroupSection";
import type { RateBucketKey, RateFolderResponse } from "@/lib/api-types";
import {
  bucketBadges,
  bucketCount,
  bucketListHref,
  bucketStage,
  BUCKETS,
  folderAverage,
  folderLabel,
  folderStageCounts,
  formatFolderAverage,
  type StatsAxis,
} from "@/lib/rate-folders";

/** 구간 앞 칩 글자. A 미만(B·C)은 합쳐서 보이고, 미플레이는 단계가 없다. */
const BUCKET_CHIP: Record<RateBucketKey, string> = {
  R95: "SS",
  R90: "S",
  R85: "S",
  R80: "S",
  R73: "A",
  BELOW: "B·C",
  UNPLAYED: "–",
};

/**
 * 폴더(레벨 폴더 또는 서열표 난이도) 하나: 접힌 머리에 제목, `기록 n/전체`, 평균(includeZero가 `0% 포함/미포함`을 정한다), 단계 분포 막대와 EXC/FC/SS/S/S 미만 칩, 펼치면 달성률 구간 7개(막대 + 개수)가 나온다.
 * 구간을 누르면 그 폴더·구간의 채보 목록 화면으로 간다.
 * 폴더의 채보를 모두 플레이했고 모두 같은 단계 이상이면 그 단계(S/SS/FC/EXC) 색으로 머리가 밝아진다(곡 목록·서열표 묶음과 같은 규칙).
 * 색만으로 구분하지 않도록 개수와 구간 이름이 글자로 같이 있다. 막대는 장식이라 aria-hidden이다.
 * 95~100% 구간에는 막대 아래에 MAX(100.00)와 FC(풀콤보, 100 미만) 개수를 뱃지로 따로 보인다.
 */
export function RateFolderCard({ axis, folder, includeZero }: { axis: StatsAxis; folder: RateFolderResponse; includeZero: boolean }) {
  const [open, setOpen] = useState(false);
  const title = folderLabel(axis, folder.key);
  const counts = folderStageCounts(folder);
  const reached = groupStage(counts);
  const bodyId = `rate-folder-${axis}-${folder.key.toFixed(2)}`;

  return (
    <section aria-label={`${axis === "level" ? "레벨" : "레이팅 상수 난이도"} ${title}`} className="overflow-hidden rounded-[14px] border border-line bg-card">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          data-stage={reached ?? undefined}
          className={`relative flex w-full flex-col gap-2 py-3 pl-4 pr-3 text-left ${reached ? "stage-tint" : ""}`}
        >
          {reached ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
          <span className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-num text-lg font-semibold text-fg">
              {title} <span className="ml-1 text-sm font-normal text-fg-sub">{folder.total}개</span>
            </span>
            {/* 모두 달성한 폴더는 단계 글자도 같이 보인다(색만으로 전달하지 않는다) */}
            {reached ? (
              <span data-stage={reached} className="stage-text font-num text-xs font-bold">
                전부 {reached} 이상
              </span>
            ) : null}
            <span className="ml-auto flex items-baseline gap-2 text-sm text-fg-sub">
              <span className="text-xs text-fg-dim">
                기록 {folder.recorded}/{folder.total}
              </span>
              <span>
                평균 <span className="font-num font-semibold text-fg">{formatFolderAverage(folderAverage(folder, includeZero))}</span>
              </span>
              <span aria-hidden="true" className="text-fg-dim">
                {open ? "▴" : "▾"}
              </span>
            </span>
          </span>
          {/* 폴더 전체의 단계 분포: 막대(장식) + 같은 숫자를 글자 칩으로 오른쪽에 모아 보인다 */}
          <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5">
            <StageBar counts={counts} total={folder.total} className="h-2 min-w-24 flex-1" />
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              {chipsOf(counts).map((chip) => (
                <span
                  key={chip.key}
                  data-stage={chip.stage ?? undefined}
                  className={`rounded-lg border border-chip-line px-2 py-0.5 text-xs ${
                    chip.count === 0 ? "text-fg-faint" : chip.stage ? "stage-text" : "text-fg-sub"
                  }`}
                >
                  {chip.label} <span className="font-num">{chip.count}</span>
                </span>
              ))}
            </span>
          </span>
        </button>
      </h3>
      <div id={bodyId} hidden={!open}>
        {open ? (
          <BucketList axis={axis} folder={folder} />
        ) : null}
      </div>
    </section>
  );
}

/**
 * 달성률 구간 7개(막대 + 개수) 목록. 모바일 아코디언과 데스크톱 우측 상세가 같이 쓴다. 구간을 누르면 채보 목록 화면으로 간다.
 * className으로 배치(세로 목록 / 2열 격자)만 바꾼다.
 */
export function BucketList({ axis, folder, className = "flex flex-col gap-1.5 border-t border-row-line p-2.5" }: { axis: StatsAxis; folder: RateFolderResponse; className?: string }) {
  const title = folderLabel(axis, folder.key);
  const badges = bucketBadges(folder, "R95");
  return (
    <ul aria-label={`${title} 달성률 구간`} className={className}>
      {BUCKETS.map(({ key, label }) => {
        const count = bucketCount(folder, key);
        const stage = bucketStage(key);
        // 막대는 구간 안의 단계로 나눠 칠한다: 95~100은 MAX(EXC) · FC · SS 순, 나머지는 한 칸. 칸 너비는 폴더 전체 채보 대비다
        const segments = (key === "R95"
          ? [
              { key: "EXC", stage: "EXC" as const, count: badges.max },
              { key: "FC", stage: "FC" as const, count: badges.fc },
              { key: "SS", stage: "SS" as const, count: count - badges.max - badges.fc },
            ]
          : [{ key, stage, count }]
        ).filter((seg) => seg.count > 0);
        return (
          <li key={key} className="rounded-lg border border-row-line bg-table-head/40">
            <Link
              href={bucketListHref(axis, folder.key, key)}
              className="flex flex-col gap-1.5 px-3 py-2 hover:bg-table-head"
              aria-label={`${label} ${count}개 보기`}
            >
              <span className="flex items-center gap-2">
                {/* 단계 글자를 채운 칩으로 같이 보인다(색만으로 구분하지 않는다) */}
                <span
                  data-stage={stage ?? undefined}
                  className={`inline-flex min-w-9 justify-center rounded px-1.5 py-px font-num text-[11px] font-bold ${stage ? "stage-chip" : "border border-chip-line text-fg-dim"}`}
                >
                  {BUCKET_CHIP[key]}
                </span>
                <span className="text-sm text-fg">{label}</span>
                <span className="ml-auto flex items-baseline gap-1 text-sm text-fg">
                  <span className="font-num font-semibold">{count}</span>
                  <span className="text-xs text-fg-sub">곡</span>
                  <span aria-hidden="true" className="ml-1 text-fg-dim">›</span>
                </span>
              </span>
              <span aria-hidden="true" className="flex h-[5px] overflow-hidden rounded-full bg-table-head">
                {segments.map((seg) => (
                  <span
                    key={seg.key}
                    data-stage={seg.stage ?? undefined}
                    data-segment={seg.key}
                    className={`h-full ${seg.stage ? "stage-bar" : "bg-chip-line"}`}
                    style={{ width: `${folder.total > 0 ? (seg.count / folder.total) * 100 : 0}%` }}
                  />
                ))}
              </span>
              {key === "R95" ? (
                <span className="flex gap-1.5 text-[11px]">
                  <span data-stage="EXC" className={`stage-text border-l-2 border-current pl-1.5 font-num font-bold ${badges.max === 0 ? "opacity-50" : ""}`}>
                    MAX {badges.max}
                  </span>
                  <span data-stage="FC" className={`stage-text border-l-2 border-current pl-1.5 font-num font-bold ${badges.fc === 0 ? "opacity-50" : ""}`}>
                    FC {badges.fc}
                  </span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
