"use client";

import { useState } from "react";
import { BucketList } from "@/components/mypage/RateFolderCard";
import { Pager, usePaged } from "@/components/Pager";
import { StageBar } from "@/components/table/StageBar";
import { groupStage, visibleChipsOf } from "@/components/table/TierGroupSection";
import type { RateFolderResponse } from "@/lib/api-types";
import { folderAverage, folderLabel, folderStageCounts, formatFolderAverage, type StatsAxis } from "@/lib/rate-folders";
import { useTranslations } from "next-intl";

/**
 * 데스크톱 통계: 왼쪽에 폴더 목록(10개씩 페이지), 오른쪽에 고른 폴더의 달성률 구간 상세.
 * 폴더를 누르면 그 폴더가 선택(윤곽선)되고 오른쪽 상세가 바뀐다. 아직 고르지 않았으면 안내 문구만 보인다.
 * 선택은 폴더의 key로 기억해서, 페이지를 넘기거나 기록을 저장해 목록이 새로 와도 같은 폴더가 선택돼 있다.
 * 모바일은 이 화면을 쓰지 않고 접이식 카드(RateFolderCard)를 쓴다.
 */
export function RateFolderMaster({ axis, folders, includeZero }: { axis: StatsAxis; folders: readonly RateFolderResponse[]; includeZero: boolean }) {
  const t = useTranslations();
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const { page, totalPages, pageItems, setPage } = usePaged(folders);
  const selected = folders.find((f) => f.key === selectedKey) ?? null;

  return (
    <div className="grid grid-cols-[18rem_minmax(0,1fr)] items-start gap-4">
      <div className="flex flex-col gap-2">
        <ul aria-label={t("MyPage.folderListAria")} className="flex flex-col gap-1.5">
          {pageItems.map((folder) => {
            const counts = folderStageCounts(folder);
            const reached = groupStage(counts);
            const isSelected = folder.key === selectedKey;
            return (
              <li key={folder.key}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={t("MyPage.folderAria", { axis, title: folderLabel(axis, folder.key, t) })}
                  onClick={() => setSelectedKey(folder.key)}
                  data-stage={reached ?? undefined}
                  className={`relative flex w-full flex-col gap-1.5 overflow-hidden rounded-xl border bg-card py-2.5 pl-4 pr-3 text-left ${
                    reached ? "stage-tint" : ""
                  } ${isSelected ? "border-fg ring-1 ring-fg" : "border-line hover:bg-table-head"}`}
                >
                  {reached ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
                  {/* 폭이 18rem이라 한 줄에 다 담으면 큰 숫자(196개, 88.18%)에서 줄이 갈린다. 윗줄: 제목 · 개수 · 평균(오른쪽), 아랫줄: 단계 막대 · 기록 수(오른쪽). 글자는 줄바꿈하지 않는다 */}
                  <span className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="font-num text-base font-semibold text-fg">{folderLabel(axis, folder.key, t)}</span>
                    <span className="text-xs text-fg-sub">{t("Songs.chartCount", { count: folder.total })}</span>
                    <span className="ml-auto text-xs text-fg-sub">
                      {t.rich("MyPage.averageRich", { n: (c) => <span className="font-num font-semibold text-fg">{c}</span>, value: formatFolderAverage(folderAverage(folder, includeZero)) })}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StageBar counts={counts} total={folder.total} className="h-1.5 min-w-0 flex-1" />
                    <span className="shrink-0 whitespace-nowrap text-xs text-fg-dim">
                      {t("MyPage.recordedCount", { recorded: folder.recorded, total: folder.total })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <Pager page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {selected ? <FolderDetail axis={axis} folder={selected} includeZero={includeZero} /> : <p className="rounded-xl border border-dashed border-line p-6 text-sm text-fg-sub">{t("MyPage.pickFolderHint")}</p>}
    </div>
  );
}

function FolderDetail({ axis, folder, includeZero }: { axis: StatsAxis; folder: RateFolderResponse; includeZero: boolean }) {
  const t = useTranslations();
  const title = folderLabel(axis, folder.key, t);
  const counts = folderStageCounts(folder);
  const reached = groupStage(counts);
  return (
    <section aria-label={t("MyPage.detailAria", { title })} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-num text-lg font-semibold text-fg">
          {title} <span className="ml-1 text-sm font-normal text-fg-sub">{t("Songs.chartCount", { count: folder.total })}</span>
        </h3>
        {reached ? (
          <span data-stage={reached} className="stage-text font-num text-xs font-bold">
            {t("MyPage.allAtLeast", { stage: reached })}
          </span>
        ) : null}
        <span className="ml-auto flex items-baseline gap-3 text-xs text-fg-dim">
          <span>
            {t("MyPage.recordedCount", { recorded: folder.recorded, total: folder.total })}
          </span>
          <span className="text-sm text-fg-sub">
            {t.rich("MyPage.averageRich", { n: (c) => <span className="font-num font-semibold text-fg">{c}</span>, value: formatFolderAverage(folderAverage(folder, includeZero)) })}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StageBar counts={counts} total={folder.total} className="h-2 min-w-24 flex-1" />
        <ul aria-label={t("MyPage.stageDistAria")} className="ml-auto flex flex-wrap items-center gap-1.5">
          {visibleChipsOf(counts).map((chip) => (
            <li
              key={chip.key}
              data-stage={chip.stage ?? undefined}
              className={`rounded-full border border-ctl px-2 py-0.5 text-xs ${
                chip.count === 0 ? "text-fg-faint" : chip.stage ? "stage-text" : "text-fg-sub"
              }`}
            >
              {chip.stage ? chip.label : t("Progress.belowS")} <span className="font-num">{chip.count}</span>
            </li>
          ))}
        </ul>
      </div>
      <BucketList axis={axis} folder={folder} className="grid grid-cols-2 gap-2" />
      <p className="text-xs text-fg-dim">{t("MyPage.bucketHint")}</p>
    </section>
  );
}
