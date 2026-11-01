import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { RatedScore } from "@/components/table/RatedScore";
import { tableDetailHref } from "@/components/song/TableContext";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";
import type { AchievementStage } from "@/lib/types";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";
import { useTranslations } from "next-intl";
import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";

/**
 * 서열표 한 줄 (모바일). 모든 줄 높이를 60px로 맞춘다(2026-11-01, 시안 `서열표 줄 B+D 안`).
 * 왼쪽: 곡명, 그 아래 `Guitar | MAS 9.80` 알약 + 속성 칩(`단일`). 둘째 줄을 접지 않아 기록이 있든 없든 줄 높이가 같다.
 * 오른쪽: `[S | 92.93]` 랭크·달성률 알약(폭 고정, 기록이 없으면 `[– | –]`), 그 아래 레이팅 점수(티어 색), 기록 입력 버튼(+).
 * 추천(상/중/하)은 속성 칩 옆 칩이다. 재킷이 보이면 JacketEntryCard(아래)를 쓴다.
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
  if (jackets.visible) {
    return <JacketEntryCard entry={entry} tier={tier} onRecord={onRecord} jacketUrl={jackets.urlOf(entry.songId)} />;
  }
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex h-[60px] items-center gap-2 border-t border-row-line pl-4 pr-3 first:border-t-0 md:hidden ${
        stage ? "stage-tint" : ""
      }`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
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
          <RecommendBadge value={entry.recommend} className="shrink-0" />
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

/**
 * 재킷이 보일 때의 서열표 모바일 줄(2026-11-01, 시안 `재킷 옆 정보 새 아이디어` 4번 → `4번 한 줄 가운데 맞춤 안` B). 줄 높이 68px.
 * 재킷(48px, 360px 미만 40px) · 왼쪽 세 줄 묶음 · 오른쪽 묶음 · `+` 버튼을 모두 줄 가운데 한 선에 맞춘다(items-center).
 *   왼쪽: `단일 | 추천 상` 작은 글자 / 곡명 / `Guitar | MAS` 알약(곡명에 바짝 붙임)
 *   오른쪽: `[S | 92.93]` 랭크·달성률 알약 / 레이팅 점수. 기록이 없어도 점수 자리(18px)를 비워 둬서
 *   `[– | –]`가 기록 있는 줄의 알약과 같은 높이에 온다(위아래 줄끼리 오른쪽이 가지런함).
 * 속성·추천을 곡명 위 글자로 옮겨 알약 줄에는 알약만 남는다(좁은 기종에서 속성 칩이 잘리던 문제, 갤럭시 S25 360px).
 */
function JacketEntryCard({
  entry,
  tier,
  onRecord,
  jacketUrl,
}: {
  entry: TableEntryResponse;
  tier: number | null;
  onRecord?: (entry: TableEntryResponse) => void;
  jacketUrl: string | null;
}) {
  const t = useTranslations();
  const stage = entry.mine?.stage ?? null;
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex h-[68px] items-center gap-2.5 border-t border-row-line pl-3 pr-3 first:border-t-0 md:hidden ${stage ? "stage-tint" : ""}`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      <SongJacket url={jacketUrl} title={entry.title} className="size-12 rounded-lg max-[359px]:size-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold leading-3 text-fg-dim">
          <span className="sr-only">{t("Chart.patternSr")} </span>
          {entry.pattern ? patternLabel(entry.pattern, t) : EMPTY_MARK}
          {entry.recommend ? (
            <>
              <span className="mx-1 text-chip-line" aria-hidden="true">|</span>
              <span className={recommendTextClass(entry.recommend)}>
                {t("Chart.recommendSr")} {recommendLabel(entry.recommend, t)}
              </span>
            </>
          ) : null}
        </p>
        <Link
          href={tableDetailHref(entry)}
          className={`mt-[3px] block truncate text-sm leading-[18px] hover:underline ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {entry.title}
        </Link>
        <span className="mt-px flex overflow-hidden">
          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} compact />
        </span>
      </div>
      <div className="flex w-[72px] shrink-0 flex-col items-end gap-1">
        <StageRatePill stage={stage} rate={entry.mine?.rate} />
        <span className="flex h-[18px]">{stage ? <RatedScore entry={entry} tier={tier} onRecord={onRecord} /> : null}</span>
      </div>
      {onRecord ? <RecordButton entry={entry} onRecord={onRecord} /> : null}
    </li>
  );
}

/** 곡명 위 작은 줄의 추천 글자 색. 추천 배지(RecommendBadge)와 같은 색 변수(DESIGN-UI 3장) */
function recommendTextClass(value: string): string {
  if (value === "상") {
    return "text-[var(--rec-high-text)]";
  }
  return value === "중" ? "text-fg-sub" : "text-fg-faint";
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
