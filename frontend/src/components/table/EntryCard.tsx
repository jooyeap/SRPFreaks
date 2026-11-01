import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { RatedScore } from "@/components/table/RatedScore";
import { StageBadge } from "@/components/table/StageBadge";
import { tableDetailHref } from "@/components/song/TableContext";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";
import { useTranslations } from "next-intl";
import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";

/**
 * 서열표 한 줄 (모바일). 재킷 칸을 숨기면서 4열 카드 격자 대신 한 줄 행으로 바꿨다.
 * 왼쪽: 곡명, 그 아래 `Guitar | MAS 9.80` 알약 + 달성 단계 + 속성. 오른쪽: 달성률, 그 아래 추천 + 레이팅 점수(티어 색), 기록 입력 버튼(+).
 * 레이팅 점수는 2026-10-10에 단계 배지 앞(왼쪽)에 뒀다가 2026-10-18에 달성률·추천과 같은 오른쪽 묶음으로 옮겼다. 기록이 있으면 data-stage를 붙여 왼쪽 4px 막대와 배경 틴트, 곡명·달성률 색을 같은 단계 색으로 맞춘다 (데스크톱 표의 EntryRow와 같은 규칙).
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
      className={`relative flex min-h-[60px] items-center gap-2 border-t border-row-line py-2 pl-4 pr-3 first:border-t-0 md:hidden ${
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
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
          {stage ? <StageBadge stage={stage} /> : null}
          <span className="text-xs text-fg-dim">{t("Chart.patternValue", { pattern: entry.pattern ? patternLabel(entry.pattern, t) : EMPTY_MARK })}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`font-num text-sm font-semibold ${stage ? "stage-text" : "text-fg-faint"}`}>
          {formatRate(entry.mine?.rate)}
        </span>
        {/* 추천과 점수(레이팅)는 달성률 아래 같은 줄에 나란히 둔다. 기록이 없으면 점수는 비워 둔다 */}
        <span className="flex items-center gap-1.5">
          <RecommendBadge value={entry.recommend} />
          {stage ? <RatedScore entry={entry} tier={tier} onRecord={onRecord} /> : null}
        </span>
      </div>
      {onRecord ? <RecordButton entry={entry} onRecord={onRecord} /> : null}
    </li>
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

/**
 * 재킷이 보일 때의 서열표 한 줄(D54 A안, 2026-11-01). 줄 높이 72px = 재킷 72px 정사각이라 왼쪽 띠·재킷·줄이 늘 같은 길이다.
 * 1줄: 곡명 · 달성률 / 2줄: 알약 · 단계 · (오른쪽) 점수 / 3줄: `단일 · 추천 상` 작은 글자. 한 줄에 몰아넣지 않아 글자가 잘리지 않는다.
 * 재킷은 줄 왼쪽 끝에 붙이고, 단계 띠(4px)는 재킷 위에 겹쳐 그린다(띠가 없는 줄에 빈 틈이 생기지 않고 재킷 위치가 늘 같다).
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
  const pattern = entry.pattern ? patternLabel(entry.pattern, t) : EMPTY_MARK;
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex h-[72px] items-center gap-2.5 border-t border-row-line pr-3 first:border-t-0 md:hidden ${stage ? "stage-tint" : ""}`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 z-10 w-1" aria-hidden="true" /> : null}
      <SongJacket url={jacketUrl} title={entry.title} className="size-[72px]" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <Link
            href={tableDetailHref(entry)}
            className={`min-w-0 flex-1 truncate text-[13px] hover:underline ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
          >
            {entry.title}
          </Link>
          <span className={`shrink-0 font-num text-sm font-semibold ${stage ? "stage-text" : "text-fg-faint"}`}>{formatRate(entry.mine?.rate)}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5">
          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
          {stage ? <StageBadge stage={stage} /> : null}
          {stage ? <span className="ml-auto flex shrink-0 items-center"><RatedScore entry={entry} tier={tier} onRecord={onRecord} /></span> : null}
        </p>
        <p className="mt-1 truncate text-[11px] text-fg-dim">
          {entry.recommend ? t("Chart.patternRecommend", { pattern, recommend: recommendLabel(entry.recommend, t) }) : t("Chart.patternValue", { pattern })}
        </p>
      </div>
      {onRecord ? <RecordButton entry={entry} onRecord={onRecord} /> : null}
    </li>
  );
}
