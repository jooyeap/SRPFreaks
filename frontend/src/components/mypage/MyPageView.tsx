"use client";

import { useQuery } from "@tanstack/react-query";
import { OverallStageCard } from "@/components/mypage/OverallStageCard";
import { RatingView } from "@/components/rating/RatingView";
import { Skeleton } from "@/components/Skeleton";
import { StatsTab } from "@/components/mypage/StatsTab";
import { MY_PAGE_TABS, overallStages, type MyPageState } from "@/lib/my-page";
import { fetchChartFolders, songListKeys } from "@/lib/song-list";

/**
 * 마이페이지: 제목, 전체 달성 현황(맨 위), `레이팅 | 통계` 탭.
 * 선택한 탭·통계 기준은 부모(주소 쿼리)가 들고 있고 여기서는 바꿔 달라고 요청만 한다(table 화면과 같은 방식).
 * 전체 달성 현황은 곡 목록의 폴더 API(/songs/chart-folders)를 합산한다. 곡 목록 화면과 같은 쿼리 키라 캐시를 함께 쓴다.
 */
export function MyPageView({ userId, state, onStateChange }: { userId: number; state: MyPageState; onStateChange: (state: MyPageState) => void }) {
  const { tab } = state;
  const folders = useQuery({
    queryKey: songListKeys.folders(userId),
    queryFn: ({ signal }) => fetchChartFolders(signal),
    select: overallStages,
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-fg">마이페이지</h1>

      {folders.data ? (
        <OverallStageCard stages={folders.data} />
      ) : folders.isError ? (
        <p role="alert" className="text-sm text-fg">달성 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : (
        <Skeleton label="달성 현황을 불러오는 중입니다." className="h-[8.5rem]" />
      )}

      <div role="tablist" aria-label="마이페이지 탭" className="flex gap-1 border-b border-line">
        {MY_PAGE_TABS.map((t) => {
          const selected = t.value === tab;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`mypage-tab-${t.value}`}
              aria-selected={selected}
              aria-controls="mypage-panel"
              onClick={() => onStateChange({ ...state, tab: t.value })}
              // 선택은 굵은 글씨와 아래 줄로도 보인다(색만으로 구분하지 않는다)
              className={`-mb-px min-h-11 border-b-2 px-4 text-sm ${
                selected ? "border-fg font-bold text-fg" : "border-transparent text-fg-sub hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="mypage-panel" aria-labelledby={`mypage-tab-${tab}`}>
        {tab === "rating" ? (
          <RatingView userId={userId} />
        ) : (
          <StatsTab userId={userId} axis={state.axis} onAxisChange={(axis) => onStateChange({ ...state, axis })} />
        )}
      </div>
    </div>
  );
}
