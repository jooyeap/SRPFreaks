import Link from "next/link";
import { ChartBadge, RecommendBadge } from "@/components/table/Badges";
import { RatedScore } from "@/components/table/RatedScore";
import { StageBadge } from "@/components/table/StageBadge";
// import { SongJacket } from "@/components/SongJacket"; // 재킷 칸 숨김 (아래 주석 참고)
import { tableDetailHref } from "@/components/song/TableContext";
import { EMPTY_MARK, formatRate } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";

/**
 * 표형 열 너비. 머리 행(TableHeadRow)과 같은 값을 써서 열이 맞는다. 채보 열(116px)은 파트·난이도·레벨 알약 하나다.
 * 열 순서: 막대 · 곡명 · 점수(레이팅에 찍히는 값, 티어 색) · 랭크(달성 단계) · 채보 · 달성률 · 추천 · 속성 · 기록 버튼 (랭크는 곡명 오른쪽이다, 2026-10-08).
 */
export const ROW_GRID =
  "md:grid md:grid-cols-[4px_minmax(0,1fr)_52px_40px_116px_64px_44px_52px_48px] md:items-center md:gap-x-3";

/** 데스크톱 표의 머리 행 (모바일에서는 보이지 않는다). */
export function TableHeadRow() {
  return (
    <div className={`hidden bg-table-head px-3 py-2 text-xs text-fg-dim ${ROW_GRID}`} aria-hidden="true">
      <span />
      <span>곡명</span>
      <span>점수</span>
      <span>랭크</span>
      <span>채보</span>
      <span>달성률</span>
      <span>추천</span>
      <span>속성</span>
      <span />
    </div>
  );
}

/**
 * 서열표 한 줄 (데스크톱 표형).
 * 기록이 있으면 data-stage를 붙여서 왼쪽 4px 막대, 행 배경 틴트, 곡명 옆 단계 표시, 달성률 숫자 색을 같은 단계 색으로 맞춘다.
 * 기록이 없으면 data-stage가 없으므로 단계 색이 하나도 적용되지 않는다 (달성률 `–`).
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
  const stage = entry.mine?.stage ?? null;
  return (
    <li
      data-stage={stage ?? undefined}
      className={`hidden border-t border-row-line px-3 py-2 text-sm md:grid ${ROW_GRID} ${stage ? "stage-tint" : ""}`}
    >
      <span className={`h-8 w-1 rounded ${stage ? "stage-bar" : "bg-transparent"}`} aria-hidden="true" />
      {/* 재킷 칸은 저작권(이미지 사용 허락) 문제가 정리될 때까지 숨긴다. 복원할 때 이 줄과 위의 import 주석을 되살린다. (ROW_GRID의 재킷 열도 함께 뺐다) */}
      {/* <SongJacket className="h-10 w-10 rounded-lg" /> */}
      <span className="flex min-w-0 items-center gap-2">
        <Link
          href={tableDetailHref(entry)}
          className={`truncate hover:underline ${stage === "EXC" || stage === "FC" ? "stage-name" : "text-fg"}`}
        >
          {entry.title}
        </Link>
      </span>
      {/* 점수(레이팅에 찍히는 값)는 랭크 앞 칸이다. 기록이 없으면 비워 둔다 */}
      <span>{stage ? <RatedScore entry={entry} tier={tier} /> : null}</span>
      {/* 랭크(달성 단계)는 곡명 오른쪽 고정 폭 칸이다. 기록이 없어도 자리를 비워 두어 채보 칸 위치가 줄마다 같다 */}
      <span>{stage ? <StageBadge stage={stage} /> : null}</span>
      <span>
        <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
      </span>
      <span className={`font-num font-semibold ${stage ? "stage-text" : "text-fg-faint"}`}>
        {formatRate(entry.mine?.rate)}
      </span>
      <span>
        <RecommendBadge value={entry.recommend} />
      </span>
      <span className="text-fg-sub">
        {entry.pattern ?? EMPTY_MARK}
      </span>
      <span>
        {onRecord ? (
          <button
            type="button"
            onClick={() => onRecord(entry)}
            aria-label={`${entry.title} 기록 입력`}
            className="rounded-full border border-chip-line px-2.5 py-0.5 text-xs text-fg-sub hover:text-fg"
          >
            기록
          </button>
        ) : null}
      </span>
    </li>
  );
}
