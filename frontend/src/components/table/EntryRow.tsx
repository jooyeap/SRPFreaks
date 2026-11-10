import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { RatedScore } from "@/components/table/RatedScore";
import { StageRatePill } from "@/components/table/StageRatePill";
import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";
import { tableDetailHref } from "@/components/song/TableContext";
import { patternLabel } from "@/lib/chart-labels";
import { EMPTY_MARK } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/**
 * 표형 열 너비(2026-11-01, 시안 `데스크톱 서열표 표 검토`). 머리 행(TableHeadRow)과 같은 값을 써서 열이 맞는다.
 * 읽는 순서대로: 곡명(재킷 포함) · 채보 190 · 속성 52 · 추천 44 | 랭크·달성률 알약 72 · 점수 64 · 기록 버튼 32.
 * 앞쪽은 "어떤 채보인지", 뒤쪽은 "내 결과"다. 랭크·달성률은 모바일과 같은 `[S | 92.93]` 알약 하나로 묶는다.
 * (예전: 곡명 · 점수 · 랭크 · 채보 · 달성률 · 추천 · 속성 순이라 점수가 곡명 옆에 오고 랭크와 달성률이 떨어져 있었다.)
 */
export const ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,1fr)_190px_52px_44px_72px_64px_32px] md:items-center md:gap-x-3";

/** 데스크톱 표의 머리 행 (모바일에서는 보이지 않는다). */
export function TableHeadRow() {
  const t = useTranslations();
  return (
    <div className={`hidden bg-table-head px-4 py-2 text-xs text-fg-dim ${ROW_GRID}`} aria-hidden="true">
      <span>{t("Songs.colTitle")}</span>
      <span>{t("Songs.colChart")}</span>
      <span>{t("Table.colPattern")}</span>
      <span>{t("Table.colRecommend")}</span>
      <span>
        {t("Songs.colRank")} · {t("Songs.colRate")}
      </span>
      <span className="text-right">{t("Table.colScore")}</span>
      <span />
    </div>
  );
}

/**
 * 서열표 한 줄 (데스크톱 표형). 줄 높이 56px.
 * 기록이 있으면 data-stage를 붙여서 왼쪽 4px 막대(줄 높이 전체, 모바일과 같다), 행 배경 틴트, 곡명·달성률 색을 같은 단계 색으로 맞춘다.
 * 기록이 없으면 data-stage가 없으므로 단계 색이 하나도 적용되지 않는다 (알약 `[– | –]`).
 */
export function EntryRow({
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
      className={`relative hidden h-14 border-t border-row-line px-4 text-sm md:grid ${ROW_GRID} ${stage ? "stage-tint" : ""}`}
    >
      {stage ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
      <span className="flex min-w-0 items-center gap-2.5">
        {/* 재킷(D54): 데스크톱 표는 곡명 앞 40px 둥근 칸 */}
        {jackets.visible ? <SongJacket url={jackets.urlOf(entry.songId)} title={entry.title} className="size-10 rounded-lg" /> : null}
        <Link
          href={tableDetailHref(entry)}
          className={`truncate hover:underline ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {entry.title}
        </Link>
      </span>
      <span>
        <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
      </span>
      <span className="text-[13px] text-fg-sub">{entry.pattern ? patternLabel(entry.pattern, t) : EMPTY_MARK}</span>
      <span>
        <RecommendBadge value={entry.recommend} />
      </span>
      <StageRatePill stage={stage} rate={entry.mine?.rate} />
      {/* 점수(레이팅에 찍히는 값)는 오른쪽 끝에 맞춘다. 기록이 없으면 비워 둔다 */}
      <span className="justify-self-end">{stage ? <RatedScore entry={entry} tier={tier} onRecord={onRecord} /> : null}</span>
      <span>
        {onRecord ? (
          <button
            type="button"
            onClick={() => onRecord(entry)}
            aria-label={t("Chart.recordInput", { title: entry.title })}
            className="flex size-8 items-center justify-center rounded-lg border border-ctl text-base leading-none text-fg hover:bg-table-head"
          >
            +
          </button>
        ) : null}
      </span>
    </li>
  );
}
