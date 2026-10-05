import Link from "next/link";
import { SongTile } from "@/components/SongTile";
import { DifficultyBadge, RecommendBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { tableDetailHref } from "@/components/song/TableContext";
import { EMPTY_MARK, formatLevel, formatRate, partLabel } from "@/lib/format";
import type { TableEntryResponse } from "@/lib/api-types";

/**
 * 서열표 한 칸 (모바일 카드형, 4열 격자의 한 칸).
 * 재킷 칸(생성 타일): 왼쪽 위 레벨, 오른쪽 위 파트, 아래 난이도 색 띠. FC/EXC는 칸 테두리를 단계 색으로 둔다.
 * 그 아래: 곡명(2줄 말줄임), 달성률 + 추천, 단계 표시, 속성. 재킷 이미지는 쓰지 않는다 (DESIGN.md 15장).
 */
export function EntryCard({ entry, onRecord }: { entry: TableEntryResponse; onRecord?: (entry: TableEntryResponse) => void }) {
  const stage = entry.mine?.stage ?? null;
  const ringed = stage === "FC" || stage === "EXC";
  return (
    <li data-stage={stage ?? undefined} className="flex min-w-0 flex-col gap-1 md:hidden">
      <SongTile songId={entry.songId} title={entry.title} className={`aspect-square rounded ${ringed ? "stage-ring" : ""}`}>
        <span className="absolute left-1 top-1 rounded bg-page/70 px-1 font-num text-[10px] text-fg">
          {formatLevel(entry.level)}
        </span>
        <span className="absolute right-1 top-1 rounded bg-page/70 px-1 text-[10px] font-bold text-fg">{partLabel(entry.part)}</span>
        <span data-difficulty={entry.difficulty} className="diff-band absolute inset-x-0 bottom-0 h-1" aria-hidden="true" />
      </SongTile>
      <Link
        href={tableDetailHref(entry)}
        className={`line-clamp-2 text-[11px] leading-tight hover:underline ${ringed && stage === "EXC" ? "stage-name" : "text-fg"}`}
      >
        {entry.title}
      </Link>
      <div className="flex items-center justify-between gap-1">
        <span className={`font-num text-xs font-semibold ${stage ? "stage-text" : "text-fg-faint"}`}>
          {formatRate(entry.mine?.rate)}
        </span>
        <RecommendBadge value={entry.recommend} uncertain={entry.recommendUncertain} />
      </div>
      {/* 칸 폭이 좁아서(약 90px) 단계·난이도·속성을 한 줄에 두면 속성이 잘린다: 배지는 한 줄(넘치면 줄바꿈), 속성은 아래 줄 */}
      <div className="flex flex-wrap items-center gap-1">
        {stage ? <StageBadge stage={stage} /> : null}
        <DifficultyBadge difficulty={entry.difficulty} />
      </div>
      <p className="text-[10px] text-fg-dim">속성 {entry.pattern ?? EMPTY_MARK}</p>
      {onRecord ? (
        <button
          type="button"
          onClick={() => onRecord(entry)}
          aria-label={`${entry.title} 기록 입력`}
          className="mt-auto rounded-full border border-chip-line py-0.5 text-[11px] text-fg-sub hover:text-fg"
        >
          기록
        </button>
      ) : null}
    </li>
  );
}
