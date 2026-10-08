// import { SongJacket } from "@/components/SongJacket"; // 재킷 칸 숨김 (아래 주석 참고)
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { EMPTY_MARK, formatRate, formatScore, formatTier } from "@/lib/format";
import type { SkillEntryResponse } from "@/lib/api-types";

/**
 * 레이팅 목록의 곡 카드 (DESIGN-UI 5장): 재킷 칸(56px) · 곡명 · 기준 난이도·상수·속성 · `Guitar | MAS 9.80` 알약 + 달성 단계 · 오른쪽에 점수와 달성률.
 * 모든 채보는 기록이 있으므로 단계가 항상 있다. 모든 단계(C~EXC)에 왼쪽 4px 띠와 배경 틴트를 단계 색으로 주고,
 * FC/EXC는 곡명 색도 바꾼다 (서열표 행과 같은 규칙. 예전에는 FC/EXC만 효과가 있었다).
 */
export function RatingEntryCard({ entry }: { entry: SkillEntryResponse }) {
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
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${nameAccent ? "stage-name" : "text-fg"}`}>
          {entry.title}
        </p>
        <p className="mt-0.5 text-xs text-fg-dim">
          기준 <span className="font-num">{formatTier(entry.tier)}</span> · 상수{" "}
          <span className="font-num">{formatScore(entry.ratingConstant)}</span> · {entry.pattern ?? EMPTY_MARK}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          <ChartBadge part={entry.part} difficulty={entry.difficulty} level={entry.level} />
          <StageBadge stage={entry.stage} />
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-num text-lg font-semibold text-fg">{formatScore(entry.score)}</p>
        <p className="stage-text font-num text-xs">{formatRate(entry.achievementRate)}</p>
      </div>
    </li>
  );
}
