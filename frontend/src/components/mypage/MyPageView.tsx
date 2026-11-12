"use client";

import { useEffect, useRef } from "react";
import { ImportEntryLink } from "@/components/import/ImportEntryLink";
import { RatingView } from "@/components/rating/RatingView";
import { SetlistTab } from "@/components/setlist/SetlistTab";
import { AnalysisTab } from "@/components/mypage/AnalysisTab";
import { StatsTab } from "@/components/mypage/StatsTab";
import { RivalTab } from "@/components/rivals/RivalTab";
import { MY_PAGE_TABS, type MyPageState } from "@/lib/my-page";
import { useTranslations } from "next-intl";

/**
 * 마이페이지: 제목과 `레이팅 | 통계 | 세트리스트 | 라이벌 | 분석` 탭. 전체 달성 현황은 통계 탭 안(StatsTab)에서 보인다.
 * 선택한 탭·통계 기준은 부모(주소 쿼리)가 들고 있고 여기서는 바꿔 달라고 요청만 한다(table 화면과 같은 방식).
 */
export function MyPageView({ userId, state, onStateChange }: { userId: number; state: MyPageState; onStateChange: (state: MyPageState) => void }) {
  const t = useTranslations();
  const { tab } = state;
  const tabListRef = useRef<HTMLDivElement>(null);

  // 탭이 다섯 개라 좁은 화면(360px, 특히 일본어)에서는 한 줄로 다 보이지 않을 수 있다. 줄바꿈 없이 한 줄을 유지하고 옆으로 밀어서 볼 수 있게 하며,
  // 선택한 탭이 보이는 위치로 탭 줄만 옮긴다(scrollIntoView는 페이지 세로 스크롤까지 움직일 수 있어 쓰지 않는다).
  useEffect(() => {
    const list = tabListRef.current;
    const selected = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!list || !selected) return;
    const target = selected.offsetLeft - (list.clientWidth - selected.offsetWidth) / 2;
    list.scrollLeft = Math.max(0, target);
  }, [tab]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-fg">{t("MyPage.title")}</h1>

      <ImportEntryLink />

      <div
        ref={tabListRef}
        role="tablist"
        aria-label={t("MyPage.tabsAria")}
        className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-table-head p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {MY_PAGE_TABS.map((tab) => {
          const selected = state.tab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`mypage-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls="mypage-panel"
              onClick={() => onStateChange({ ...state, tab: tab.value })}
              // 선택은 굵은 글씨와 테두리로도 보인다(색만으로 구분하지 않는다)
              className={`min-h-10 flex-1 shrink-0 whitespace-nowrap rounded-lg px-2 text-sm sm:px-4 ${
                selected ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-sub hover:text-fg"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="mypage-panel" aria-labelledby={`mypage-tab-${tab}`}>
        {tab === "rating" ? (
          <RatingView userId={userId} />
        ) : tab === "setlist" ? (
          <SetlistTab userId={userId} />
        ) : tab === "rival" ? (
          <RivalTab userId={userId} />
        ) : tab === "analysis" ? (
          <AnalysisTab userId={userId} />
        ) : (
          <StatsTab userId={userId} axis={state.axis} onAxisChange={(axis) => onStateChange({ ...state, axis })} />
        )}
      </div>
    </div>
  );
}
