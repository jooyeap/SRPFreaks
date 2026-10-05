import Link from "next/link";
import { SongTile } from "@/components/SongTile";
import { PartBadge, RecommendBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { EMPTY_MARK, difficultyLabel, formatLevel, formatTier } from "@/lib/format";
import type { TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { neighbors } from "@/lib/songs";

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
          <dt className="text-xs text-fg-dim">기준 난이도</dt>
          <dd className="font-num text-[22px] font-bold leading-tight text-fg">
            {formatTier(group.tier)}
            {entry.tierUncertain ? "?" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-dim">추천</dt>
          <dd>
            {entry.recommend ? (
              <RecommendBadge value={entry.recommend} uncertain={entry.recommendUncertain} />
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
              href={tableDetailHref(c)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-fg hover:bg-table-head"
            >
              <span className="w-14">
                <PartBadge part={c.part} />
              </span>
              <span className="font-num text-fg-sub">
                {difficultyLabel(c.difficulty)} {formatLevel(c.level)}
              </span>
              <span className="ml-auto">{c.mine ? <StageBadge stage={c.mine.stage} /> : <span className="text-xs text-fg-faint">기록 없음</span>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** 같은 묶음의 곡: 서열표 순서의 이전 / 다음 곡. 눌러서 이동한다. 묶음의 처음/끝에서는 없는 쪽을 흐리게 둔다. */
export function NeighborLinks({ group, index }: { group: TierGroupResponse; index: number }) {
  const { prev, next } = neighbors(group, index);
  return (
    <section aria-label="같은 묶음의 곡" className="flex flex-col gap-2">
      <h2 className="flex items-baseline justify-between px-1 font-num text-[17px] font-bold text-fg">
        같은 묶음의 곡
        <span className="font-sans text-[11px] font-normal text-fg-dim">이전 / 다음</span>
      </h2>
      <div className="overflow-hidden rounded-[14px] border border-line bg-card">
        <NeighborItem label="이전" entry={prev} />
        <NeighborItem label="다음" entry={next} />
      </div>
    </section>
  );
}

function NeighborItem({ label, entry }: { label: string; entry: TableEntryResponse | null }) {
  if (!entry) {
    return (
      <div className="border-t border-row-line px-3.5 py-2.5 text-sm text-fg-faint first:border-t-0">
        {label} <span className="ml-1">없음</span>
      </div>
    );
  }
  return (
    <Link
      href={tableDetailHref(entry)}
      className="flex items-center gap-2.5 border-t border-row-line px-3.5 py-2.5 first:border-t-0 hover:bg-table-head"
    >
      <span className="w-[30px] text-[11px] text-fg-dim">{label}</span>
      <SongTile songId={entry.songId} className="h-8 w-8 rounded-[7px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-fg">{entry.title}</span>
        <span className="block text-[11px] text-fg-dim">
          <PartBadge part={entry.part} /> {difficultyLabel(entry.difficulty)} <span className="font-num">{formatLevel(entry.level)}</span>
        </span>
      </span>
      {entry.mine ? <StageBadge stage={entry.mine.stage} /> : <span className="text-[11px] text-fg-faint">기록 없음</span>}
    </Link>
  );
}
