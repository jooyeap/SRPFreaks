import { ChartRow, ROW_COLUMNS } from "@/components/songs/ChartRow";
import type { ChartRowResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/** 채보 행 목록 + `더 보기`(20개씩 이어 붙임, 모바일·데스크톱 공통). 총 개수는 서버가 준 값을 그대로 쓴다. */
export function ChartList({
  label,
  rows,
  hasMore,
  loadingMore,
  onMore,
  hrefOf,
}: {
  label: string;
  rows: ChartRowResponse[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  /** 곡 상세 주소를 바꿀 때 */
  hrefOf?: (row: ChartRowResponse) => string;
}) {
  const t = useTranslations();
  return (
    <>
      {/* 데스크톱 열 머리글. 행(ChartRow)과 같은 열 너비·좌우 여백을 쓴다. 장식이라 화면 읽기 프로그램에는 숨기고(aria-hidden) 모바일에는 없다 */}
      <div
        aria-hidden="true"
        className={`hidden border-t border-row-line py-1.5 pl-4 pr-3 text-xs text-fg-dim md:grid ${ROW_COLUMNS} md:gap-x-3`}
      >
        <span>{t("Songs.colTitle")}</span>
        <span>{t("Songs.colChart")}</span>
        <span>
          {t("Songs.colRank")} · {t("Songs.colRate")}
        </span>
      </div>
      <ul aria-label={label}>
        {rows.map((row) => (
          <ChartRow key={row.songDifficultyId} row={row} href={hrefOf?.(row)} />
        ))}
      </ul>
      {hasMore ? (
        <div className="border-t border-row-line p-2 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onMore}
            className="min-h-11 rounded-lg border border-ctl px-4 py-1 text-sm text-fg-sub enabled:hover:text-fg disabled:text-disabled"
          >
            {loadingMore ? t("Songs.loadingMore") : t("Songs.loadMore")}
          </button>
        </div>
      ) : null}
    </>
  );
}
