import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";
import { ChartBadge } from "@/components/table/Badges";
import type { SongChartResponse, SongDetailResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";
import { patternLabel } from "@/lib/chart-labels";

const CHIP = "rounded-lg border border-ctl px-2 py-0.5 text-xs font-bold text-fg-sub";

/**
 * 곡명 첫 줄의 위 공백 보정(px). 곡명은 line-height 1.15라서 첫 줄 글자 위에 줄 상자 여백이 생겨,
 * 정보 칸을 재킷 위 선에 맞춰도 곡명 글자가 재킷보다 조금 아래에서 시작해 보인다. 이 값만큼 위로 당긴다(2026-11-14, 360px 측정).
 */
export const TITLE_TOP_TRIM_PX = 2;

/**
 * 곡 정보 헤더 (시안 "곡 상세 상단 재킷 높이 안에" 안 1, 2026-11-14): 재킷 칸 + 정보 칸(곡명·아티스트 / 태그 줄)이 위쪽 정렬로 놓이고,
 * 정보 칸은 재킷 높이(모바일 104px · 데스크톱 140px) 안에서 위(곡명+아티스트)와 아래(태그 줄)로 벌어진다.
 * 재킷 칸 아래쪽 띠는 선택된 채보의 난이도 색이다 (색만이 아니라 칩의 글자로도 난이도를 적는다).
 * 아티스트·버전처럼 띄어쓰기 없이 긴 글자가 와도 화면 폭을 넘지 않게 한다(아티스트는 줄바꿈, 버전 칩은 말줄임. 2026-10-13: 긴 버전 이름이 모바일에서 페이지 전체를 오른쪽으로 넓혔다).
 * 속성 칩은 서열표에서 들어온 화면에만 두고(pattern을 넘길 때만), 값이 없으면 그리지 않는다 (DESIGN-UI 6장). 태그 줄(버전 · 채보 알약 · 속성)에 함께 놓는다.
 * `action`(리스트에 추가 · ROOT·ADMIN의 `관리`)은 재킷+정보 블록 **아래** 한 줄로 내려 놓는다(정보 칸이 재킷 높이를 넘지 않게). 없으면 그 줄은 그리지 않는다.
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
  /** 헤더 아래 한 줄에 둘 버튼들(`리스트에 추가`, ROOT·ADMIN의 `관리`). 없으면 줄 자체를 그리지 않는다 */
  action?: React.ReactNode;
}) {
  const t = useTranslations();
  const jackets = useJackets();
  const withJacket = jackets.visible;
  const patternText = pattern ? t("Chart.patternValue", { pattern: patternLabel(pattern, t) }) : null;
  return (
    <div className="flex flex-col gap-3">
      <section aria-label={t("Song.songInfo")} className="flex items-start gap-3.5">
        {/* 재킷(D54, A안): 모바일 104px · 데스크톱 140px 정사각. 아래 띠는 선택된 채보의 난이도 색(글자는 알약에도 있다).
            속성 칩은 재킷이 보일 때 재킷 왼쪽 위 모서리 칩으로 둔다(레이팅 곡 카드와 같은 방식, 2026-11-08): 태그 줄에 두면 360px에서 줄이 꺾여 정보 칸이 재킷 높이를 넘는다.
            칩은 누르는 요소가 아니고 글자는 읽기 프로그램에도 읽히며(재킷 바깥 상자는 aria-hidden이 아니다) title로 전체 문구를 준다. */}
        {withJacket ? (
          <SongJacket
            url={jackets.urlOf(song.id)}
            title={song.title}
            className="size-[104px] self-start rounded-[14px] md:size-[140px] md:rounded-[18px]"
            badge={
              patternText ? (
                <span
                  title={patternText}
                  data-testid="pattern-chip"
                  className="absolute -left-1.5 -top-[5px] z-[1] max-w-[104px] truncate whitespace-nowrap rounded-[7px] border border-ctl bg-page px-[5px] text-[10px] font-semibold leading-[15px] text-fg shadow-sm"
                >
                  {patternText}
                </span>
              ) : undefined
            }
          >
            {chart ? <span data-difficulty={chart.difficultyType} className="diff-band absolute inset-x-0 bottom-0 h-1.5" /> : null}
          </SongJacket>
        ) : null}
        {/* 정보 칸: 재킷 높이만큼 최소 높이를 주고 위(곡명+아티스트)·아래(태그 줄)로 벌린다. 재킷이 없으면 내용 높이 그대로 */}
        <div className={`flex min-w-0 flex-1 flex-col justify-between gap-1.5 ${withJacket ? "min-h-[104px] md:min-h-[140px]" : ""}`}>
          <div className="flex flex-col gap-1" style={{ marginTop: -TITLE_TOP_TRIM_PX }}>
            {/* 전체 곡명: 재킷이 있는 모바일은 2줄까지만 보이고 말줄임이다(데스크톱은 칸이 넉넉해 그대로 보인다) */}
            <h1 className={`min-w-0 break-words font-num font-bold leading-[1.15] text-fg ${withJacket ? "line-clamp-2 text-[22px] md:line-clamp-none md:text-[26px]" : "text-[26px]"}`}>{song.title}</h1>
            {song.artist ? <p className="break-words text-[13px] text-fg-dim">{song.artist}</p> : null}
          </div>
          <p className="flex flex-wrap items-center gap-1.5">
            {song.addedVersion ? <span title={song.addedVersion} className={`${CHIP} max-w-full truncate font-num`}>{song.addedVersion}</span> : null}
            {chart ? <ChartBadge part={chart.instrumentPart} difficulty={chart.difficultyType} level={chart.level} /> : null}
            {/* 재킷이 없을 때(설정 꺼짐)는 칸 자체가 없어 폭이 넓으므로 속성 칩을 태그 줄 맨 뒤에 둔다 */}
            {!withJacket && patternText ? (
              <span className="rounded-lg border border-ctl bg-card px-2 py-0.5 text-xs font-bold text-fg">{patternText}</span>
            ) : null}
          </p>
        </div>
      </section>
      {/* 버튼 줄: 페이지 너비 전체. 담기 버튼이 남는 폭(flex-1), 관리 버튼은 작게. 버튼이 하나도 없으면(비로그인 등) 줄을 그리지 않는다 */}
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
