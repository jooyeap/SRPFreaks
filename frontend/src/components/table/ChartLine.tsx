import Link from "next/link";
import type { ReactNode } from "react";
import { SongJacket } from "@/components/SongJacket";
import { ChartBadge } from "@/components/table/Badges";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";
import { EMPTY_MARK, formatTier } from "@/lib/format";
import type { AchievementStage, DifficultyType, InstrumentPart } from "@/lib/types";
import { useTranslations } from "next-intl";

/**
 * 곡 한 줄 (모바일)의 공통 모양 (D64, 줄 통일). 서열표 줄(EntryCard)과 세트리스트 줄(추천·담긴 목록)이 이 컴포넌트 하나를 쓰고,
 * 이후 라이벌 비교 줄도 같은 컴포넌트에 `lead`(순번)와 `aside`를 바꿔 끼워 쓴다. 재킷을 켜든 끄든 배치는 같고 재킷 칸만 있고 없을 뿐이다.
 *
 * 높이 68px, 모든 칸을 줄 가운데 한 선에 맞춘다(items-center).
 *   [lead] [재킷 48px(360px 미만 40px)]  윗줄 작은 글자 `속성 | 서열 난이도 숫자`(서열표 줄은 `속성 | 추천 상`)
 *                                       곡명 (말줄임)
 *                                       파트·난이도 한 알약 `Guitar | MAS 9.65`(ChartBadge)   [aside]  [action]
 * 알약은 예전 서열표·세트리스트 줄과 같은 한 덩어리다(파트 칸 최소 폭이 있어 Guitar/Bass가 섞여도 난이도 칸 시작 위치가 같다).
 * 난이도 알약과 파트 글자를 따로 그리는 모양(DifficultyPill + PartText)은 레이팅 카드 이미지(캔버스)에만 쓰고 앱 줄에는 쓰지 않는다(2026-11-09 정정).
 * 기록이 있으면(stage) 왼쪽 4px 막대와 배경 틴트를 단계 색으로 준다(데스크톱 표의 EntryRow와 같은 규칙).
 *
 * 오른쪽(aside)·맨 오른쪽(action)은 부르는 쪽이 채운다: 서열표는 `[단계|달성률]` 알약 + 레이팅 점수 + `+` 버튼,
 * 세트리스트는 알약 + `담기`/`담김`(또는 `입력`·`빼기`) 버튼이다.
 */
export function ChartLine({
  className = "",
  stage = null,
  done,
  lead,
  jacket,
  pattern,
  tier,
  recommend,
  topExtra,
  title,
  href,
  titleClass = "text-fg",
  part,
  difficulty,
  level,
  aside,
  action,
}: {
  /** li 바깥 모양(구분선, 카드 테두리 등). 높이·간격은 이 컴포넌트가 정한다 */
  className?: string;
  /** 내 기록의 달성 단계. 있으면 왼쪽 막대와 배경 틴트를 준다 */
  stage?: AchievementStage | null;
  /** 세트리스트 줄의 완료 여부(data-done) */
  done?: boolean;
  /** 재킷 왼쪽 칸(라이벌 비교의 순번 등). 없으면 칸이 없다 */
  lead?: ReactNode;
  /** 재킷을 보일 때만 값이 있다(url이 없으면 같은 크기의 단색 칸). 재킷을 끄면 null이고 칸이 없다 */
  jacket: { url: string | null } | null;
  pattern: string | null;
  /** 서열 난이도 숫자(라벨 없이 `5.4`). undefined면 숫자 칸을 두지 않는다(서열표 줄은 묶음 머리에 이미 있다). null이면 `미정` */
  tier?: number | null;
  /** 추천도(`상`/`중`/`하`). 있을 때만 `| 추천 상`을 붙인다(서열표 줄) */
  recommend?: string | null;
  /** 윗줄 끝에 붙일 짧은 표지(세트리스트의 `✓ 완료`) */
  topExtra?: ReactNode;
  title: string;
  href: string;
  /** 곡명 글자 색 클래스(FC/EXC는 단계 색) */
  titleClass?: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  /** 오른쪽 묶음(알약·점수·버튼 등). 폭은 부르는 쪽이 정한다 */
  aside?: ReactNode;
  /** 맨 오른쪽 버튼(서열표의 `+`) */
  action?: ReactNode;
}) {
  const t = useTranslations();
  return (
    <li
      data-stage={stage ?? undefined}
      data-done={done === undefined ? undefined : done ? "true" : "false"}
      className={`relative flex h-[68px] items-center gap-2.5 ${jacket ? "pl-3" : "pl-4"} pr-3 ${stage ? "stage-tint" : ""} ${className}`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      {lead}
      {jacket ? <SongJacket url={jacket.url} title={title} className="size-12 shrink-0 rounded-lg max-[359px]:size-10" /> : null}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[10px] font-bold leading-3 text-fg-dim">
          <span className="min-w-0 truncate">
            <span className="sr-only">{t("Chart.patternSr")} </span>
            {pattern ? patternLabel(pattern, t) : EMPTY_MARK}
            {tier !== undefined ? (
              <>
                <span className="mx-1 text-chip-line" aria-hidden="true">|</span>
                <span className="sr-only">{t("Chart.tierSr")} </span>
                <span className="font-num">{formatTier(tier, t)}</span>
              </>
            ) : null}
            {recommend ? (
              <>
                <span className="mx-1 text-chip-line" aria-hidden="true">|</span>
                <span className={recommendTextClass(recommend)}>
                  {t("Chart.recommendSr")} {recommendLabel(recommend, t)}
                </span>
              </>
            ) : null}
          </span>
          {topExtra}
        </p>
        <Link href={href} className={`mt-1 block truncate text-sm leading-[18px] hover:underline ${titleClass}`}>
          {title}
        </Link>
        <span className="mt-1 flex items-center gap-1.5 overflow-hidden">
          <ChartBadge part={part} difficulty={difficulty} level={level} compact />
        </span>
      </div>
      {aside}
      {action}
    </li>
  );
}

/** 윗줄의 추천 글자 색. 추천 배지(RecommendBadge)와 같은 색 변수(DESIGN-UI 3장) */
function recommendTextClass(value: string): string {
  if (value === "상") {
    return "text-[var(--rec-high-text)]";
  }
  return value === "중" ? "text-fg-sub" : "text-fg-faint";
}
