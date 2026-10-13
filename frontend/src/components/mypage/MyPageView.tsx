"use client";

import { RatingView } from "@/components/rating/RatingView";
import { StatsTab } from "@/components/mypage/StatsTab";
import { MY_PAGE_TABS, type MyPageState } from "@/lib/my-page";

/**
 * 마이페이지: 제목과 `레이팅 | 통계` 탭. 전체 달성 현황은 통계 탭 안(StatsTab)에서 보인다.
 * 선택한 탭·통계 기준은 부모(주소 쿼리)가 들고 있고 여기서는 바꿔 달라고 요청만 한다(table 화면과 같은 방식).
 */
export function MyPageView({ userId, state, onStateChange }: { userId: number; state: MyPageState; onStateChange: (state: MyPageState) => void }) {
  const { tab } = state;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-fg">마이페이지</h1>

      <div role="tablist" aria-label="마이페이지 탭" className="flex gap-1 rounded-xl border border-line bg-table-head p-1">
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
              // 선택은 굵은 글씨와 테두리로도 보인다(색만으로 구분하지 않는다)
              className={`min-h-10 flex-1 rounded-lg px-4 text-sm ${
                selected ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-sub hover:text-fg"
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
