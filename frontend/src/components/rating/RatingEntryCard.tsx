import Link from "next/link";
import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";
import { ChartBadge } from "@/components/table/Badges";
import { StageRatePill } from "@/components/table/StageRatePill";
import { chartTierAttrs } from "@/lib/chart-tier";
import { patternLabel } from "@/lib/chart-labels";
import { EMPTY_MARK, formatScore, formatTier } from "@/lib/format";
import type { SkillEntryResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/**
 * 레이팅 목록의 곡 카드 (DESIGN-UI 5장, 누르면 곡 상세): 재킷 칸(56px) · 곡명 · 기준 난이도·상수·속성 · `Guitar | MAS 9.80` 알약 + 달성 단계 · 오른쪽에 점수와 달성률.
 * 모든 채보는 기록이 있으므로 단계가 항상 있다. 모든 단계(C~EXC)에 왼쪽 4px 띠와 배경 틴트를 단계 색으로 주고,
 * FC/EXC는 곡명 색도 바꾼다 (서열표 행과 같은 규칙. 예전에는 FC/EXC만 효과가 있었다).
 */
export function RatingEntryCard({
  entry,
  onDelete,
}: {
  entry: SkillEntryResponse;
  /** 있으면 `삭제` 버튼을 그린다(관리자가 남의 기록을 지울 때만, D29). 카드 전체를 덮는 링크보다 위(z-10)에 둔다. */
  onDelete?: (entry: SkillEntryResponse) => void;
}) {
  const t = useTranslations();
  const nameAccent = entry.stage === "FC" || entry.stage === "EXC";
  const jackets = useJackets();
  const patternText = entry.pattern ? patternLabel(entry.pattern, t) : EMPTY_MARK;
  return (
    <li
      data-stage={entry.stage}
      // max-[359px]: 360px 미만에서는 `Guitar | MAS 9.80` 알약(약 114px)이 곡명 칸보다 넓어 점수 칸을 덮는다.
      // 그 폭에서만 재킷·여백을 줄여 알약이 들어갈 자리를 만든다 (360px 이상은 그대로).
      className="stage-tint relative flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-card py-2 pl-4 pr-3 max-[359px]:gap-2 max-[359px]:pl-3 max-[359px]:pr-2"
    >
      {/* 왼쪽 띠는 점수의 플레이어 티어 색 하나다(상수표 칸과 같은 색, lib/chart-tier.ts). 색만으로 전달하지 않는다: 점수 숫자가 오른쪽에 있다 */}
      <span {...chartTierAttrs(entry.score)} className="tier-bar tier-bar-v absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
      {/* 재킷(D54): 52px 둥근 썸네일을 카드 가운데에, 띠와 여백을 두고 둔다(360px 미만 44px). 보일 때는 곡명을 13px 한 줄로 줄인다 */}
      {/* 속성은 재킷이 보일 때 재킷 왼쪽 위 모서리 칩으로 옮긴다(2026-11-08): 정보 줄에 두면 일본어 `複合(単色)`가 중간 칸(약 150px)에 안 들어가 그 줄만 꺾이고 카드가 커졌다.
          칩은 누르는 요소가 아니다. 글자는 읽기 프로그램에도 읽히고(재킷 바깥 상자는 aria-hidden이 아니다) title로 전체 문구를 준다.
          색은 토큰만(page / fg / ctl-line), 최대 84px를 넘으면 말줄임이 안전장치다. 재킷 왼쪽은 막대에서 9px 떨어져 있고 칩은 -6px라 막대와 3px 남는다 */}
      {jackets.visible ? (
        <SongJacket
          url={jackets.urlOf(entry.songId)}
          title={entry.title}
          className="size-[52px] rounded-lg max-[359px]:size-11"
          badge={
            <span
              title={patternText}
              data-testid="pattern-chip"
              className="absolute -left-1.5 -top-[5px] z-[1] max-w-[84px] truncate whitespace-nowrap rounded-[7px] border border-ctl bg-page px-[5px] text-[10px] font-semibold leading-[15px] text-fg shadow-sm"
            >
              {patternText}
            </span>
          }
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={`truncate ${jackets.visible ? "text-[13px]" : "text-sm"} ${nameAccent ? "stage-name" : "text-fg"}`}>
          {/* 곡명 링크의 클릭 영역을 ::after로 카드 전체에 넓힌다(카드 안에 다른 링크·버튼이 없다). 서열표에서 들어온 것과 같은 상세 화면(서열표 정보 포함)으로 간다 */}
          <Link
            href={`/songs/${entry.songId}?from=table&chart=${entry.songDifficultyId}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-check-line"
          >
            {entry.title}
          </Link>
        </p>
        <p className="mt-0.5 text-xs text-fg-dim">
          {/* 재킷이 있으면 속성은 칩에만 둔다(위). 재킷 칸이 없으면 폭이 넓어 한 줄에 들어가므로 예전처럼 맨 뒤에 둔다 */}
          {jackets.visible
            ? t.rich("Rating.entryBaseNoPattern", {
                n: (c) => <span className="font-num">{c}</span>,
                tier: formatTier(entry.tier, t),
                constant: formatScore(entry.ratingConstant),
              })
            : t.rich("Rating.entryBase", {
                n: (c) => <span className="font-num">{c}</span>,
                tier: formatTier(entry.tier, t),
                constant: formatScore(entry.ratingConstant),
                pattern: patternText,
              })}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
        </p>
      </div>
      {/* 오른쪽: 점수(위) / `[SS | 95.75]` 랭크·달성률 알약(아래). 서열표 줄의 오른쪽 칸과 같은 모양이다(2026-11-02, 시안 `레이팅 카드 알약 통일` A) */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {/* 곡 점수는 플레이어 티어 색 글자다(lib/chart-tier.ts). 숫자가 그대로 보이므로 색만으로 전달하지 않는다. 하수봉 기준을 넘으면 빛이 더해진다 */}
        <p {...chartTierAttrs(entry.score)} className="tier-score font-num pr-1 text-lg font-semibold leading-6 tabular-nums">
          {formatScore(entry.score)}
        </p>
        <StageRatePill stage={entry.stage} rate={entry.achievementRate} align="end" />
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(entry)}
            aria-label={t("Rating.deleteRecordAria", { title: entry.title })}
            className="relative z-10 mt-1 rounded-lg border border-ctl px-2.5 py-0.5 text-xs text-fg-sub hover:text-fg"
          >
            {t("Song.delete")}
          </button>
        ) : null}
      </div>
    </li>
  );
}
