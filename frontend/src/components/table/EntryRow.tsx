import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { RatedScore } from "@/components/table/RatedScore";
import { StageRatePill } from "@/components/table/StageRatePill";
import { SongJacket } from "@/components/SongJacket";
import { STAGE_EDGE_CLIP, StageEdgeBar } from "@/components/StageEdgeBar";
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

/**
 * 내 기록 칸(랭크·달성률 알약, 점수, 기록 버튼)이 없는 표의 열 너비(2026-11-12, 비로그인 서열표 폴더).
 * 로그인하지 않으면 알약이 전부 `[– | –]`로 비어 보이므로 칸 자체를 두지 않는다. 앞쪽 네 칸 너비는 ROW_GRID와 같다.
 */
export const ROW_GRID_PLAIN = "md:grid md:grid-cols-[minmax(0,1fr)_190px_52px_44px] md:items-center md:gap-x-3";

/** 데스크톱 표의 머리 행 (모바일에서는 보이지 않는다). */
export function TableHeadRow({ showRecord = true }: { showRecord?: boolean }) {
  const t = useTranslations();
  return (
    <div className={`hidden bg-table-head px-4 py-2 text-xs text-fg-dim ${showRecord ? ROW_GRID : ROW_GRID_PLAIN}`} aria-hidden="true">
      <span>{t("Songs.colTitle")}</span>
      <span>{t("Songs.colChart")}</span>
      <span>{t("Table.colPattern")}</span>
      <span>{t("Table.colRecommend")}</span>
      {showRecord ? (
        <>
          <span>
            {t("Songs.colRank")} · {t("Songs.colRate")}
          </span>
          <span className="text-right">{t("Table.colScore")}</span>
          <span />
        </>
      ) : null}
    </div>
  );
}

/**
 * 서열표 한 줄 (데스크톱 표형). 줄 높이 56px.
 * 기록이 있으면 data-stage를 붙여서 왼쪽 4px 막대(줄 높이 전체, 모바일과 같다), 행 배경 틴트, 곡명·달성률 색을 같은 단계 색으로 맞춘다.
 * 기록이 없으면 data-stage가 없으므로 단계 색이 하나도 적용되지 않는다 (알약 `[– | –]`).
 *
 * 줄 전체 누르기(2026-11-12): 곡명 링크의 `::after`를 줄(li, relative) 전체로 펼쳐 줄 어디를 눌러도 곡 상세로 간다.
 * 줄 하나에 링크가 하나뿐이라 키보드 탭 순서와 화면 읽기에서 링크가 중복되지 않고, 포커스 링도 줄 전체에 그려져 이중으로 보이지 않는다.
 * 안쪽의 버튼(점수 칩 `기록 수정`, `+`)은 줄보다 위에 둬서(`relative`, 뒤에 그려지는 위치 지정 요소가 위) 따로 눌린다.
 * `<a>`를 줄에 감싸거나 줄에 onClick으로 이동시키는 방식은 버튼을 링크 안에 넣게 되고(중첩 상호작용 요소) 링크가 둘로 읽혀서 쓰지 않는다.
 * 오버레이를 쓰는 곡 목록 폴더(TierGroupSection 머리)와 같은 방식이다. 모바일 줄(EntryCard)은 그대로다(손가락으로 밀 때 줄 전체가 눌리는 것을 피한다).
 */
export function EntryRow({
  entry,
  tier = null,
  onRecord,
  showRecord = true,
}: {
  entry: TableEntryResponse;
  /** 묶음의 레이팅 상수 난이도. 기록이 있을 때 레이팅 점수를 계산하는 데 쓴다(미정이면 null) */
  tier?: number | null;
  onRecord?: (entry: TableEntryResponse) => void;
  /** false면 내 기록 칸(알약·점수·기록 버튼)을 그리지 않는다(비로그인 폴더). 머리 행(TableHeadRow)도 같은 값을 쓴다 */
  showRecord?: boolean;
}) {
  const t = useTranslations();
  const stage = entry.mine?.stage ?? null;
  const jackets = useJackets();
  return (
    <li
      data-stage={stage ?? undefined}
      className={`relative ${STAGE_EDGE_CLIP} hidden h-14 border-t border-row-line px-4 text-sm hover:bg-table-head md:grid ${showRecord ? ROW_GRID : ROW_GRID_PLAIN} ${stage ? "stage-tint" : ""}`}
    >
      {stage ? <StageEdgeBar /> : null}
      <span className="flex min-w-0 items-center gap-2.5">
        {/* 재킷(D54): 데스크톱 표는 곡명 앞 40px 둥근 칸 */}
        {jackets.visible ? <SongJacket url={jackets.urlOf(entry.songId)} title={entry.title} className="size-10 rounded-lg" /> : null}
        <Link
          href={tableDetailHref(entry)}
          // after: 줄 전체로 펼친 투명 덮개(줄 전체 누르기). 링크는 위치 기준이 아니라서 덮개의 기준은 줄(li)이고, truncate(overflow)에도 잘리지 않는다.
          // 포커스 링은 줄 전체(덮개)에만 그린다: 링크 글자에 생기는 기본 윤곽선은 끈다(안 그러면 글자 상자와 줄 상자가 이중으로 보인다)
          className={`truncate hover:underline focus-visible:outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
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
      {showRecord ? (
        <>
          <StageRatePill stage={stage} rate={entry.mine?.rate} />
          {/* 점수(레이팅에 찍히는 값)는 오른쪽 끝에 맞춘다. 기록이 없으면 비워 둔다 */}
          <span className="justify-self-end">{stage ? <RatedScore entry={entry} tier={tier} onRecord={onRecord} /> : null}</span>
          <span>
            {onRecord ? (
              <button
                type="button"
                onClick={() => onRecord(entry)}
                aria-label={t("Chart.recordInput", { title: entry.title })}
                // relative: 곡명 링크의 줄 전체 덮개보다 위에 그려져서 이 버튼은 따로 눌린다
                className="relative flex size-8 items-center justify-center rounded-lg border border-ctl text-base leading-none text-fg hover:bg-table-head"
              >
                +
              </button>
            ) : null}
          </span>
        </>
      ) : null}
    </li>
  );
}
