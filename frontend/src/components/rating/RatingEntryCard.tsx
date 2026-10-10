import Link from "next/link";
// import { SongJacket } from "@/components/SongJacket"; // 재킷 칸 숨김 (아래 주석 참고)
import { ChartBadge } from "@/components/table/Badges";
import { chartTierAttrs } from "@/lib/chart-tier";
import { EMPTY_MARK, formatRate, formatScore, formatTier } from "@/lib/format";
import type { SkillEntryResponse } from "@/lib/api-types";

/**
 * 레이팅 목록의 곡 카드 (DESIGN-UI 5장, 누르면 곡 상세): 재킷 칸(56px) · 곡명 · 기준 난이도·상수·속성 · `Guitar | MAS 9.80` 알약 · 오른쪽에 달성률. 왼쪽(순위 옆) 칸은 위아래 반반: 위 = 달성 단계, 아래 = 점수(플레이어 티어 색).
 * 모든 채보는 기록이 있으므로 단계가 항상 있다. 모든 단계(C~EXC)에 왼쪽 4px 띠와 배경 틴트를 단계 색으로 주고,
 * FC/EXC는 곡명 색도 바꾼다 (서열표 행과 같은 규칙. 예전에는 FC/EXC만 효과가 있었다).
 */
export function RatingEntryCard({
  entry,
  onDelete,
}: {
  entry: SkillEntryResponse;
  /** 있으면 `삭제` 버튼을 그린다(관리자가 남의 기록을 지울 때만, D29). 카드 전체를 덮는 링크보다 위(z-10)에 둔다. */
  onDelete?: (entry: SkillEntryResponse) => void;
}) {
  const nameAccent = entry.stage === "FC" || entry.stage === "EXC";
  return (
    <li
      data-stage={entry.stage}
      // max-[359px]: 360px 미만에서는 `Guitar | MAS 9.80` 알약(약 114px)이 곡명 칸보다 넓어 점수 칸을 덮는다.
      // 그 폭에서만 순위·재킷·여백을 줄여 알약이 들어갈 자리를 만든다 (360px 이상은 그대로).
      className="stage-tint relative flex items-center gap-3 overflow-hidden rounded-xl border border-line bg-card py-2 pl-4 pr-3 max-[359px]:gap-2 max-[359px]:pl-3 max-[359px]:pr-2"
    >
      <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" />
      <span className="w-6 shrink-0 text-center font-num text-xs text-fg-dim max-[359px]:w-4" aria-label={`${entry.rank}위`}>
        {entry.rank}
      </span>
      {/* 재킷 칸은 저작권(이미지 사용 허락) 문제가 정리될 때까지 숨긴다. 복원할 때 이 줄과 위의 import 주석을 되살린다. */}
      {/* <SongJacket className="h-14 w-14 rounded-lg max-[359px]:h-10 max-[359px]:w-10" /> */}
      {/* 위아래 반반: 위 = 달성 단계(랭크) 색, 아래 = 점수의 플레이어 티어 색(상수표와 같은 칸, .chart-cell).
          단계 글자와 점수 숫자가 그대로 보이므로 색만으로 전달하지 않는다. 하수봉 기준을 넘으면 빛이 더해진다 */}
      <div className="flex w-16 shrink-0 flex-col overflow-hidden rounded-lg text-center max-[359px]:w-14">
        <p
          data-stage={entry.stage}
          aria-label={`달성 단계 ${entry.stage}`}
          className="stage-chip border-b border-black/25 py-0.5 font-num text-xs font-bold leading-4"
        >
          {entry.stage}
        </p>
        <p {...chartTierAttrs(entry.score)} className="chart-cell py-1 font-num text-sm font-bold leading-4">
          {formatScore(entry.score)}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${nameAccent ? "stage-name" : "text-fg"}`}>
          {/* 곡명 링크의 클릭 영역을 ::after로 카드 전체에 넓힌다(카드 안에 다른 링크·버튼이 없다). 서열표에서 들어온 것과 같은 상세 화면(서열표 정보 포함)으로 간다 */}
          <Link
            href={`/songs/${entry.songId}?from=table&chart=${entry.songDifficultyId}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-chip-line"
          >
            {entry.title}
          </Link>
        </p>
        <p className="mt-0.5 text-xs text-fg-dim">
          기준 <span className="font-num">{formatTier(entry.tier)}</span> · 상수{" "}
          <span className="font-num">{formatScore(entry.ratingConstant)}</span> · {entry.pattern ?? EMPTY_MARK}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="stage-text font-num text-sm font-semibold">{formatRate(entry.achievementRate)}</p>
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(entry)}
            aria-label={`${entry.title} 기록 삭제`}
            className="relative z-10 mt-1 rounded-full border border-chip-line px-2.5 py-0.5 text-xs text-fg-sub hover:text-fg"
          >
            삭제
          </button>
        ) : null}
      </div>
    </li>
  );
}
