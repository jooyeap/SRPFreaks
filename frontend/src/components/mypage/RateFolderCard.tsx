"use client";

import Link from "next/link";
import { useState } from "react";
import { groupStage } from "@/components/table/TierGroupSection";
import type { RateFolderResponse } from "@/lib/api-types";
import {
  bucketBadges,
  bucketCount,
  bucketListHref,
  bucketStage,
  BUCKETS,
  folderLabel,
  folderStageCounts,
  type StatsAxis,
} from "@/lib/rate-folders";

/**
 * 폴더(레벨 폴더 또는 서열표 난이도) 하나: 접힌 머리에 제목과 `기록 n/전체`, 펼치면 달성률 구간 7개(막대 + 개수)가 나온다.
 * 구간을 누르면 그 폴더·구간의 채보 목록 화면으로 간다.
 * 폴더의 채보를 모두 플레이했고 모두 같은 단계 이상이면 그 단계(S/SS/FC/EXC) 색으로 머리가 밝아진다(곡 목록·서열표 묶음과 같은 규칙).
 * 색만으로 구분하지 않도록 개수와 구간 이름이 글자로 같이 있다. 막대는 장식이라 aria-hidden이다.
 * 95~100% 구간에는 막대 아래에 MAX(100.00)와 FC(풀콤보, 100 미만) 개수를 뱃지로 따로 보인다.
 */
export function RateFolderCard({ axis, folder }: { axis: StatsAxis; folder: RateFolderResponse }) {
  const [open, setOpen] = useState(false);
  const title = folderLabel(axis, folder.key);
  const reached = groupStage(folderStageCounts(folder));
  const bodyId = `rate-folder-${axis}-${folder.key.toFixed(2)}`;
  const badges = bucketBadges(folder, "R95");

  return (
    <section aria-label={`${axis === "level" ? "레벨" : "레이팅 상수 난이도"} ${title}`} className="overflow-hidden rounded-[14px] border border-line bg-card">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          data-stage={reached ?? undefined}
          className={`relative flex w-full items-center gap-3 py-3 pl-4 pr-3 text-left ${reached ? "stage-tint" : ""}`}
        >
          {reached ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
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
            <span aria-hidden="true" className="text-fg-dim">
              {open ? "▴" : "▾"}
            </span>
          </span>
        </button>
      </h3>
      <div id={bodyId} hidden={!open}>
        {open ? (
          <ul aria-label={`${title} 달성률 구간`} className="flex flex-col border-t border-row-line">
            {BUCKETS.map(({ key, label }) => {
              const count = bucketCount(folder, key);
              const stage = bucketStage(key);
              const width = folder.total > 0 ? (count / folder.total) * 100 : 0;
              return (
                <li key={key} className="border-b border-row-line last:border-b-0">
                  <Link
                    href={bucketListHref(axis, folder.key, key)}
                    className="flex flex-col gap-1.5 px-4 py-2.5 hover:bg-table-head"
                    aria-label={`${label} ${count}개 보기`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-fg">{label}</span>
                      <span className="font-num text-sm font-semibold text-fg">{count}</span>
                    </span>
                    <span aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-table-head">
                      {count > 0 ? (
                        <span
                          data-stage={stage ?? undefined}
                          className={`h-full ${stage ? "stage-bar" : "bg-chip-line"}`}
                          style={{ width: `${width}%` }}
                        />
                      ) : null}
                    </span>
                    {key === "R95" ? (
                      <span className="flex gap-1.5 text-[11px]">
                        <span data-stage="EXC" className={`stage-chip rounded px-1.5 py-px font-num font-bold ${badges.max === 0 ? "opacity-50" : ""}`}>
                          MAX {badges.max}
                        </span>
                        <span data-stage="FC" className={`stage-chip rounded px-1.5 py-px font-num font-bold ${badges.fc === 0 ? "opacity-50" : ""}`}>
                          FC {badges.fc}
                        </span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
