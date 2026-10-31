import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";
import { ChartBadge } from "@/components/table/Badges";
import type { SongChartResponse, SongDetailResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";
import { patternLabel } from "@/lib/chart-labels";

const CHIP = "rounded-lg border border-chip-line px-2 py-0.5 text-xs font-bold text-fg-sub";

/**
 * 곡 정보 헤더 (시안 "곡 상세"): 큰 재킷 칸(단색) + 곡명, 아티스트, 칩 줄(버전, `Guitar | MAS 9.80` 알약).
 * 재킷 칸 아래쪽 띠는 선택된 채보의 난이도 색이다 (색만이 아니라 칩의 글자로도 난이도를 적는다).
 * 아티스트·버전처럼 띄어쓰기 없이 긴 글자가 와도 화면 폭을 넘지 않게 한다(아티스트는 줄바꿈, 버전 칩은 말줄임. 2026-10-13: 긴 버전 이름이 모바일에서 페이지 전체를 오른쪽으로 넓혔다).
 * 속성 칩은 서열표에서 들어온 화면에만 두고(pattern을 넘길 때만), 값이 없으면 숨긴다 (DESIGN-UI 6장).
 */
export function SongHeader({
  song,
  chart,
  pattern,
  action,
}: {
  song: SongDetailResponse;
  chart: SongChartResponse | null;
  /** 서열표에서 고른 채보의 속성. null/undefined이면 칩을 그리지 않는다 */
  pattern?: string | null;
  /** 곡명 줄 오른쪽에 둘 버튼(ROOT·ADMIN의 `관리`). 없으면 그리지 않는다 */
  action?: React.ReactNode;
}) {
  const t = useTranslations();
  const jackets = useJackets();
  const withJacket = jackets.visible;
  return (
    <section aria-label={t("Song.songInfo")} className="flex items-stretch gap-3.5">
      {/* 재킷(D54, A안): 모바일 96px · 데스크톱 140px. 아래 띠는 선택된 채보의 난이도 색(글자는 알약에도 있다) */}
      {withJacket ? (
        <SongJacket url={jackets.urlOf(song.id)} title={song.title} className="size-24 self-start rounded-[14px] md:size-[140px] md:rounded-[18px]">
          {chart ? <span data-difficulty={chart.difficultyType} className="diff-band absolute inset-x-0 bottom-0 h-1.5" /> : null}
        </SongJacket>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 py-0.5">
        {/* 속성 칩 자리는 값이 없어도 높이를 잡아 둬서, 속성 유무로 곡명 위치가 흔들리지 않게 한다 */}
        <div className="flex min-h-[26px] justify-end">
          {pattern ? (
            <span className="rounded-lg border border-chip-line bg-card px-2.5 py-0.5 text-[13px] font-bold text-fg">
              {t("Chart.patternValue", { pattern: patternLabel(pattern, t) })}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className={`min-w-0 break-words font-num font-bold leading-[1.15] text-fg ${withJacket ? "line-clamp-2 text-[22px] md:line-clamp-none md:text-[26px]" : "text-[26px]"}`}>{song.title}</h1>
            {/* 재킷이 있으면 모바일에서는 버튼을 아래 배지 줄 오른쪽으로 내린다(곡명 칸이 좁아서) */}
            {action ? <div className={`shrink-0 ${withJacket ? "hidden md:block" : ""}`}>{action}</div> : null}
          </div>
          {song.artist ? <p className="break-words text-[13px] text-fg-dim">{song.artist}</p> : null}
        </div>
        <p className="flex flex-wrap items-center gap-1.5">
          {song.addedVersion ? <span title={song.addedVersion} className={`${CHIP} max-w-full truncate font-num`}>{song.addedVersion}</span> : null}
          {chart ? <ChartBadge part={chart.instrumentPart} difficulty={chart.difficultyType} level={chart.level} /> : null}
          {withJacket && action ? <span className="ml-auto md:hidden">{action}</span> : null}
        </p>
      </div>
    </section>
  );
}
