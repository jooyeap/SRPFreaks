import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { RatedScore } from "@/components/table/RatedScore";
import { StageBadge } from "@/components/table/StageBadge";
import { tableDetailHref } from "@/components/song/TableContext";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { useTranslations } from "next-intl";
import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";

/**
 * 서열표 한 줄 (모바일). 재킷 칸을 숨기면서 4열 카드 격자 대신 한 줄 행으로 바꿨다.
 * 왼쪽: 곡명, 그 아래 `Guitar | MAS 9.80` 알약 + 달성 단계 + 속성. 오른쪽: 달성률, 그 아래 추천 + 레이팅 점수(티어 색), 기록 입력 버튼(+).
 * 재킷이 보이면 곡명 앞에 44px 둥근 썸네일을 둔다(D54, 2026-11-01. 줄을 채우던 72px 재킷·세 줄 배치에서 바꿈).
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
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex min-h-[60px] items-center ${jackets.visible ? "gap-2.5" : "gap-2"} border-t border-row-line py-2 pl-4 pr-3 first:border-t-0 md:hidden ${
        stage ? "stage-tint" : ""
      }`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      {/* 재킷(D54): 44px 둥근 썸네일을 줄 가운데에 둔다. 줄 높이에 맞춰 늘리지 않아 두 줄로 접혀도 모양이 그대로다 */}
      {jackets.visible ? <SongJacket url={jackets.urlOf(entry.songId)} title={entry.title} className="size-11 rounded-lg" /> : null}
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
