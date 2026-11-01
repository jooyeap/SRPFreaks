import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { RatedScore } from "@/components/table/RatedScore";
import { tableDetailHref } from "@/components/song/TableContext";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";
import type { AchievementStage } from "@/lib/types";
import { patternLabel } from "@/lib/chart-labels";
import { useTranslations } from "next-intl";
import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";

/**
 * 서열표 한 줄 (모바일). 모든 줄 높이를 60px로 맞춘다(2026-11-01, 시안 `서열표 줄 B+D 안`).
 * 왼쪽: 곡명, 그 아래 `Guitar | MAS 9.80` 알약 + 속성 칩(`단일`). 둘째 줄을 접지 않아 기록이 있든 없든 줄 높이가 같다.
 * 오른쪽: `[S | 92.93]` 랭크·달성률 알약(폭 고정, 기록이 없으면 `[– | –]`), 그 아래 레이팅 점수(티어 색), 기록 입력 버튼(+).
 * 추천(상/중/하)은 재킷이 보이면 재킷 오른쪽 아래 꼬리표, 재킷을 끄면 속성 칩 옆 칩이다.
 * (예전: 단계 배지가 둘째 줄에 있어 기록 있는 줄만 속성이 아래로 밀려 줄이 길었다.)
 * 기록이 있으면 data-stage를 붙여 왼쪽 4px 막대와 배경 틴트, 곡명·달성률 색을 같은 단계 색으로 맞춘다 (데스크톱 표의 EntryRow와 같은 규칙).
 */
export function EntryCard({
  entry,
  tier = null,
  onRecord,
}: {
  entry: TableEntryResponse;
  /** 묶음의 레이팅 상수 난이도. 기록이 있을 때 레이팅 점수를 계산하는 데 쓴다(미정이면 null) */
  tier?: number | null;
  onRecord?: (entry: TableEntryResponse) => void;
}) {
  const t = useTranslations();
  const stage = entry.mine?.stage ?? null;
  const jackets = useJackets();
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex h-[60px] items-center gap-2 border-t border-row-line pl-4 pr-3 first:border-t-0 md:hidden ${
        stage ? "stage-tint" : ""
      }`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      {/* 재킷(D54): 44px 둥근 썸네일을 줄 가운데에 두고, 추천을 오른쪽 아래 꼬리표로 얹는다.
          360px 미만은 왼쪽 칸이 좁아 36px로 줄인다 */}
      {jackets.visible ? (
        <span className="relative shrink-0">
          <SongJacket url={jackets.urlOf(entry.songId)} title={entry.title} className="size-11 rounded-lg max-[359px]:size-9" />
          {entry.recommend ? (
            // 꼬리표 아래 재킷 그림이 비치지 않게 카드 색을 깐다(추천 상은 배경이 반투명)
            // 18px 정사각 고정: 상/중/하(高/中/低) 어느 글자든 같은 크기이고, 바탕 칸도 배지와 같은 크기·둥글기라 테두리 밖으로 비치지 않는다
            <span className="absolute -bottom-0.5 -right-0.5 flex size-[18px] rounded bg-card">
              <RecommendBadge value={entry.recommend} className="flex! size-full items-center justify-center px-0! py-0! text-[10px]! leading-none!" />
            </span>
          ) : null}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <Link
          href={tableDetailHref(entry)}
          className={`block truncate text-sm hover:underline ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {entry.title}
        </Link>
        <p className="mt-1 flex items-center gap-1.5 overflow-hidden">
          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} compact />
          {entry.pattern ? <PatternChip label={patternLabel(entry.pattern, t)} /> : null}
          {!jackets.visible ? <RecommendBadge value={entry.recommend} className="shrink-0" /> : null}
        </p>
      </div>
      <div className="flex w-[72px] shrink-0 flex-col items-end gap-1">
        <StageRatePill stage={stage} rate={entry.mine?.rate} />
        {stage ? <RatedScore entry={entry} tier={tier} onRecord={onRecord} /> : <span className="h-[18px]" aria-hidden="true" />}
      </div>
      {onRecord ? <RecordButton entry={entry} onRecord={onRecord} /> : null}
    </li>
  );
}

/** 속성 칩(`단일`). 읽기 프로그램에는 앞에 `속성`을 숨겨 읽힌다. 자리가 모자라면 이 칩만 줄어들어 잘린다 */
function PatternChip({ label }: { label: string }) {
  const t = useTranslations();
  return (
    <span className="min-w-0 truncate rounded border border-chip-line px-1 text-[11px] leading-4 text-fg-sub">
      <span className="sr-only">{t("Chart.patternSr")} </span>
      {label}
    </span>
  );
}

/**
 * `[S | 92.93]` 랭크·달성률 알약. 폭 72px 고정(왼쪽 랭크 칸 28px)이라 `EXC | MAX`, `S | 92.93`, `– | –`가 위아래로 맞는다.
 * 랭크 칸 색은 StageBadge와 같은 .stage-chip, 달성률 색은 .stage-text. 글자를 항상 적어 색만으로 전달하지 않는다.
 */
function StageRatePill({ stage, rate }: { stage: AchievementStage | null; rate: number | null | undefined }) {
  const t = useTranslations();
  return (
    <span className="inline-flex w-[72px] overflow-hidden rounded font-num text-[11px] font-bold leading-[18px]">
      {stage ? (
        <span data-stage={stage} aria-label={t("Chart.stage", { stage })} className="stage-chip w-7 shrink-0 text-center">
          {stage}
        </span>
      ) : (
        <span className="w-7 shrink-0 bg-table-head text-center text-fg-faint">{EMPTY_MARK}</span>
      )}
      <span className={`flex-1 bg-table-head px-1.5 text-right text-xs ${stage ? "stage-text" : "text-fg-faint"}`}>
        {stage ? formatRate(rate) : EMPTY_MARK}
      </span>
    </span>
  );
}

/** 기록 입력 `+` 버튼. 보이는 크기는 32px 그대로, ::after로 누를 수 있는 영역만 사방 6px 넓힌다(44px). 모바일에서 옆 줄 버튼을 잘못 누르지 않게 한다 */
function RecordButton({ entry, onRecord }: { entry: TableEntryResponse; onRecord: (entry: TableEntryResponse) => void }) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={() => onRecord(entry)}
      aria-label={t("Chart.recordInput", { title: entry.title })}
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-chip-line text-base leading-none text-fg after:absolute after:-inset-1.5 after:content-[''] hover:bg-table-head"
    >
      +
    </button>
  );
}
