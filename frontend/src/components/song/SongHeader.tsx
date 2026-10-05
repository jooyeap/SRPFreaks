import { DifficultyBadge } from "@/components/table/Badges";
import { formatLevel, partLabel } from "@/lib/format";
import type { SongChartResponse, SongDetailResponse } from "@/lib/api-types";

/**
 * 곡 정보: 재킷 칸(단색), 곡명, 아티스트, 칩 줄(버전, 파트, `MAS 9.80`).
 * 속성 칩은 서열표에서 들어온 화면에만 두고(pattern을 넘길 때만), 값이 없으면 숨긴다 (DESIGN-UI 6장).
 */
export function SongHeader({
  song,
  chart,
  pattern,
}: {
  song: SongDetailResponse;
  chart: SongChartResponse | null;
  /** 서열표에서 고른 채보의 속성. null/undefined이면 칩을 그리지 않는다 */
  pattern?: string | null;
}) {
  return (
    <section aria-label="곡 정보" className="relative flex gap-4 rounded-lg border border-line bg-card p-4">
      <div className="h-20 w-20 shrink-0 rounded bg-jacket" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold leading-snug text-fg">{song.title}</h1>
        {song.artist ? <p className="mt-0.5 text-sm text-fg-sub">{song.artist}</p> : null}
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          {song.addedVersion ? (
            <span className="rounded border border-chip-line px-1.5 py-px text-fg-sub">{song.addedVersion}</span>
          ) : null}
          {chart ? (
            <>
              <span className="rounded border border-chip-line px-1.5 py-px text-fg-sub">
                {partLabel(chart.instrumentPart)}
              </span>
              <span className="flex items-center gap-1 text-fg-sub">
                <DifficultyBadge difficulty={chart.difficultyType} />
                <span className="font-num">{formatLevel(chart.level)}</span>
              </span>
            </>
          ) : null}
        </p>
      </div>
      {pattern ? (
        <span className="absolute right-3 top-3 rounded-full border border-chip-line px-2 py-0.5 text-xs text-fg-sub">
          속성 {pattern}
        </span>
      ) : null}
    </section>
  );
}
