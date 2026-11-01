import Link from "next/link";
import { ChartBadge } from "@/components/table/Badges";
import { RatedScore } from "@/components/table/RatedScore";
import { tableDetailHref } from "@/components/song/TableContext";
import { EMPTY_MARK } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";
import { useTranslations } from "next-intl";
import { SongJacket } from "@/components/SongJacket";
import { StageRatePill } from "@/components/table/StageRatePill";
import { useJackets } from "@/lib/jackets";

/**
 * 서열표 한 줄 (모바일). 재킷을 켜든 끄든 같은 배치다(2026-11-01, 시안 `재킷 끈 서열표 줄 시안` A): 재킷 칸만 있고 없을 뿐이다.
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
  const jackets = useJackets();
  return (
    <EntryLine
      entry={entry}
      tier={tier}
      onRecord={onRecord}
      jacket={jackets.visible ? { url: jackets.urlOf(entry.songId) } : null}
    />
  );
}

/**
 * 서열표 모바일 줄의 실제 모양(2026-11-01, 시안 `재킷 옆 정보 새 아이디어` 4번 → `4번 한 줄 가운데 맞춤 안` B). 줄 높이 68px.
 * 재킷(있을 때만, 48px, 360px 미만 40px) · 왼쪽 세 줄 묶음 · 오른쪽 묶음 · `+` 버튼을 모두 줄 가운데 한 선에 맞춘다(items-center).
 *   왼쪽: `단일 | 추천 상` 작은 글자 / 곡명 / `Guitar | MAS` 알약 (줄 사이 4px씩, 시안 `4번 B 간격 비교` A)
 *   오른쪽: `[S | 92.93]` 랭크·달성률 알약 / 레이팅 점수. 기록이 없어도 점수 자리(18px)를 비워 둬서
 *   `[– | –]`가 기록 있는 줄의 알약과 같은 높이에 온다(위아래 줄끼리 오른쪽이 가지런함).
 * 속성·추천을 곡명 위 글자로 옮겨 알약 줄에는 알약만 남는다(좁은 기종에서 속성 칩이 잘리던 문제, 갤럭시 S25 360px).
 */
function EntryLine({
  entry,
  tier,
  onRecord,
  jacket,
}: {
  entry: TableEntryResponse;
  tier: number | null;
  onRecord?: (entry: TableEntryResponse) => void;
  /** 재킷을 보일 때만 값이 있다(url이 없으면 같은 크기의 단색 칸). 재킷을 끄면 null이고 칸이 없다 */
  jacket: { url: string | null } | null;
}) {
  const t = useTranslations();
  const stage = entry.mine?.stage ?? null;
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative flex h-[68px] items-center gap-2.5 border-t border-row-line ${jacket ? "pl-3" : "pl-4"} pr-3 first:border-t-0 md:hidden ${stage ? "stage-tint" : ""}`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      {jacket ? <SongJacket url={jacket.url} title={entry.title} className="size-12 rounded-lg max-[359px]:size-10" /> : null}
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
          className={`mt-1 block truncate text-sm leading-[18px] hover:underline ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {entry.title}
        </Link>
        <span className="mt-1 flex overflow-hidden">
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
