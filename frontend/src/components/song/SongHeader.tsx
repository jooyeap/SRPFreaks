import { difficultyLabel, formatLevel, partLabel } from "@/lib/format";
import type { SongChartResponse, SongDetailResponse } from "@/lib/api-types";

const CHIP = "rounded-full border border-chip-line px-2 py-0.5 text-xs font-bold text-fg-sub";

/**
 * 곡 정보 헤더 (시안 "곡 상세"): 큰 재킷 칸(단색) + 곡명, 아티스트, 칩 줄(버전, 파트, `MAS 9.80`).
 * 재킷 칸 아래쪽 띠는 선택된 채보의 난이도 색이다 (색만이 아니라 칩의 글자로도 난이도를 적는다).
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
    <section aria-label="곡 정보" className="flex items-stretch gap-3.5">
      <div
        data-difficulty={chart?.difficultyType}
        className="relative h-[124px] w-[124px] shrink-0 overflow-hidden rounded-[18px] bg-jacket"
        aria-hidden="true"
      >
        {chart ? <span className="diff-band absolute inset-x-0 bottom-0 h-1.5" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 py-0.5">
        {/* 속성 칩 자리는 값이 없어도 높이를 잡아 둬서, 속성 유무로 곡명 위치가 흔들리지 않게 한다 */}
        <div className="flex min-h-[26px] justify-end">
          {pattern ? (
            <span className="rounded-lg border border-chip-line bg-card px-2.5 py-0.5 text-[13px] font-bold text-fg">
              속성 {pattern}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="break-all font-num text-[26px] font-bold leading-[1.15] text-fg">{song.title}</h1>
          {song.artist ? <p className="text-[13px] text-fg-dim">{song.artist}</p> : null}
        </div>
        <p className="flex flex-wrap items-center gap-1.5">
          {song.addedVersion ? <span className={`${CHIP} font-num`}>{song.addedVersion}</span> : null}
          {chart ? (
            <>
              <span
                data-difficulty={chart.difficultyType}
                className="diff-chip rounded-md px-1.5 py-px font-num text-[11px] font-bold leading-normal"
              >
                {difficultyLabel(chart.difficultyType)} {formatLevel(chart.level)}
              </span>
              <span className={CHIP}>{partLabel(chart.instrumentPart)}</span>
            </>
          ) : null}
        </p>
      </div>
    </section>
  );
}
