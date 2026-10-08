import { ChartRow } from "@/components/songs/ChartRow";
import type { ChartRowResponse } from "@/lib/api-types";

/** 채보 행 목록 + `더 보기`(20개씩 이어 붙임, 모바일·데스크톱 공통). 총 개수는 서버가 준 값을 그대로 쓴다. */
export function ChartList({
  label,
  rows,
  hasMore,
  loadingMore,
  onMore,
}: {
  label: string;
  rows: ChartRowResponse[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}) {
  return (
    <>
      <ul aria-label={label}>
        {rows.map((row) => (
          <ChartRow key={row.songDifficultyId} row={row} />
        ))}
      </ul>
      {hasMore ? (
        <div className="border-t border-row-line p-2 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onMore}
            className="rounded-full border border-chip-line px-4 py-1 text-sm text-fg-sub enabled:hover:text-fg disabled:text-disabled"
          >
            {loadingMore ? "불러오는 중" : "더 보기"}
          </button>
        </div>
      ) : null}
    </>
  );
}
