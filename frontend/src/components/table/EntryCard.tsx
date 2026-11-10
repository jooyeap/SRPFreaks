import { ChartLine } from "@/components/table/ChartLine";
import { RatedScore } from "@/components/table/RatedScore";
import { tableDetailHref } from "@/components/song/TableContext";
import type { TableEntryResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";
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
 * 서열표 모바일 줄의 실제 모양. 세트리스트 줄과 같은 공통 줄(ChartLine, D64)을 쓴다. 줄 높이 68px.
 *   왼쪽: `단일 | 추천 상` 작은 글자 / 곡명 / 난이도 알약 `MAS 9.50` + 파트 글자 `Guitar`
 *   오른쪽: `[S | 92.93]` 랭크·달성률 알약 / 레이팅 점수(소수는 작게). 기록이 없어도 점수 자리(18px)를 비워 둬서
 *   `[– | –]`가 기록 있는 줄의 알약과 같은 높이에 온다(위아래 줄끼리 오른쪽이 가지런함). 맨 오른쪽에 `+` 버튼.
 * 서열 난이도 숫자는 줄마다 두지 않는다(묶음 머리에 이미 있다). 속성·추천은 곡명 위 글자라 알약 줄에는 알약과 파트 글자만 남는다.
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
  const stage = entry.mine?.stage ?? null;
  return (
    <ChartLine
      className="border-t border-row-line first:border-t-0 md:hidden"
      stage={stage}
      jacket={jacket}
      pattern={entry.pattern}
      recommend={entry.recommend}
      title={entry.title}
      href={tableDetailHref(entry)}
      titleClass={stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}
      part={entry.part}
      difficulty={entry.difficulty}
      level={entry.level}
      aside={
        <div className="flex w-[72px] shrink-0 flex-col items-end gap-1">
          <StageRatePill stage={stage} rate={entry.mine?.rate} />
          <span className="flex h-[18px]">{stage ? <RatedScore entry={entry} tier={tier} onRecord={onRecord} smallDecimal /> : null}</span>
        </div>
      }
      action={onRecord ? <RecordButton entry={entry} onRecord={onRecord} /> : null}
    />
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
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ctl text-base leading-none text-fg after:absolute after:-inset-1.5 after:content-[''] hover:bg-table-head"
    >
      +
    </button>
  );
}
