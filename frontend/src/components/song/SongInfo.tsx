import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { EMPTY_MARK, formatTier } from "@/lib/format";
import type { SongDetailResponse, TierGroupResponse } from "@/lib/api-types";
import { findChart, sortCharts } from "@/lib/songs";

/** 곡 목록에서 들어온 곡 상세 주소. */
export function songsDetailHref(songId: number, chartId: number): string {
  return `/songs/${songId}?from=songs&chart=${chartId}`;
}

/**
 * 정보 카드: 버전. BPM과 노트 수는 화면에 보이지 않는다(2026-10-08). 값은 서버가 계속 주므로
 * 다시 보이게 할 때는 여기에 항목만 더하면 된다(lib/songs.ts의 formatBpm, formatNoteCount를 그대로 쓸 수 있다).
 */
export function InfoCards({ song }: { song: SongDetailResponse }) {
  const items = [{ label: "버전", value: song.addedVersion ?? EMPTY_MARK }];
  return (
    <ul className="grid grid-cols-1 gap-2" aria-label="곡 정보 요약">
      {items.map((item) => (
        <li key={item.label} className="rounded-xl border border-line bg-card px-3 py-2.5">
          <p className="text-xs text-fg-dim">{item.label}</p>
          <p className="mt-0.5 truncate font-num text-base font-bold text-fg">{item.value}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * 레벨 정보 표: 채보(파트 · 난이도 · 레벨 알약) · 기준 난이도(서열표 값) · 추천. 곡의 모든 채보를 보여 주고,
 * 선택된 채보는 왼쪽 막대와 배경으로 강조한다 (강조는 aria-current로도 알린다). 속성은 표시하지 않는다 (DESIGN-UI 6장).
 * 서열표 정보가 아직 없거나 서열표에 없는 채보는 `–`로 둔다.
 */
export function LevelTable({
  song,
  selectedId,
  groups,
}: {
  song: SongDetailResponse;
  selectedId: number | null;
  groups: readonly TierGroupResponse[] | null;
}) {
  const charts = sortCharts(song.difficulties);
  return (
    <section aria-label="레벨 정보" className="overflow-hidden rounded-lg border border-line bg-card">
      <h2 className="px-4 py-3 text-sm font-semibold text-fg-sub">레벨 정보</h2>
      <div className="grid grid-cols-[4px_116px_1fr_44px] items-center gap-x-2 bg-table-head px-3 py-2 text-xs text-fg-dim" aria-hidden="true">
        <span />
        <span>채보</span>
        <span>기준 난이도</span>
        <span>추천</span>
      </div>
      <ul>
        {charts.map((chart) => {
          const found = groups ? findChart(groups, chart.id) : null;
          const selected = chart.id === selectedId;
          return (
            <li key={chart.id} className="border-t border-row-line">
              <Link
                href={songsDetailHref(song.id, chart.id)}
                aria-current={selected ? "true" : undefined}
                className={`grid grid-cols-[4px_116px_1fr_44px] items-center gap-x-2 px-3 py-2 text-sm ${
                  selected ? "bg-table-head" : "hover:bg-table-head"
                }`}
              >
                <span className={`h-6 w-1 rounded ${selected ? "bg-chip-on-bg" : "bg-transparent"}`} aria-hidden="true" />
                <span>
                  <ChartBadge part={chart.instrumentPart} difficulty={chart.difficultyType} level={chart.level} />
                </span>
                <span className="font-num text-fg-sub">
                  {found ? formatTier(found.group.tier) : EMPTY_MARK}
                </span>
                <span>
                  {found?.entry.recommend ? (
                    <RecommendBadge value={found.entry.recommend} />
                  ) : (
                    <span className="text-fg-faint">{EMPTY_MARK}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
