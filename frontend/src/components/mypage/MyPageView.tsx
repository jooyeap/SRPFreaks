"use client";

import { ImportEntryLink } from "@/components/import/ImportEntryLink";
import { RatingView } from "@/components/rating/RatingView";
import { SetlistTab } from "@/components/setlist/SetlistTab";
import { AnalysisTab } from "@/components/mypage/AnalysisTab";
import { StatsTab } from "@/components/mypage/StatsTab";
import { RivalTab } from "@/components/rivals/RivalTab";
import { MY_PAGE_SUB_VIEWS, MY_PAGE_TABS, hasSubViews, type MyPageState } from "@/lib/my-page";
import { useTranslations } from "next-intl";

/**
 * 마이페이지: 제목과 `레이팅 | 통계 | 리스트 | 라이벌` 밑줄 탭(D75). 전체 달성 현황은 통계 탭 안(StatsTab)에서 보인다.
 * 탭 안에 하위 항목이 2개 이상이면 글자로 된 하위 전환(`내 레이팅 · 분석`)을 그린다. 지금은 레이팅 탭만 해당한다(리스트 탭은 세트리스트 하나라 그리지 않는다).
 * 선택한 탭·하위 전환·통계 기준은 부모(주소 쿼리)가 들고 있고 여기서는 바꿔 달라고 요청만 한다(table 화면과 같은 방식).
 */
export function MyPageView({ userId, state, onStateChange }: { userId: number; state: MyPageState; onStateChange: (state: MyPageState) => void }) {
  const t = useTranslations();
  const { tab } = state;
  const subViews = MY_PAGE_SUB_VIEWS[tab];
  const tabLabelKey = MY_PAGE_TABS.find((item) => item.value === tab)?.labelKey ?? "MyPage.tabRating";

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-fg">{t("MyPage.title")}</h1>

      <ImportEntryLink />

      <div className="flex flex-col gap-3">
        {/* 상위 탭 네 개는 360px(일본어 포함)에서도 한 줄에 들어간다. 선택은 색만이 아니라 굵은 글씨와 아래 밑줄(두께)로도 보인다. */}
        <div role="tablist" aria-label={t("MyPage.tabsAria")} className="flex border-b border-line">
          {MY_PAGE_TABS.map((item) => {
            const selected = tab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                id={`mypage-tab-${item.value}`}
                aria-selected={selected}
                aria-controls="mypage-panel"
                onClick={() => onStateChange({ ...state, tab: item.value, view: null })}
                className={`-mb-px min-h-11 flex-1 whitespace-nowrap border-b-2 px-1 text-sm ${
                  selected ? "border-[var(--stage-ss-bar)] font-bold text-fg" : "border-transparent text-fg-sub hover:text-fg"
                }`}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>

        {hasSubViews(subViews) ? (
          // 하위 전환은 알약이 아니라 점(·)으로 나눈 글자다. 선택된 글자는 굵게 + 밑줄.
          <div role="group" aria-label={t(tabLabelKey)} className="flex flex-wrap items-center gap-x-1 text-sm">
            {subViews.map((item, index) => {
              const selected = (state.view ?? null) === item.value;
              return (
                <span key={item.value ?? "default"} className="flex items-center gap-1">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-fg-faint">
                      ·
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onStateChange({ ...state, view: item.value })}
                    className={`min-h-11 px-1.5 ${selected ? "font-bold text-fg underline decoration-2 underline-offset-4" : "text-fg-sub hover:text-fg"}`}
                  >
                    {t(item.labelKey)}
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      <div role="tabpanel" id="mypage-panel" aria-labelledby={`mypage-tab-${tab}`}>
        {tab === "rating" ? (
          state.view === "analysis" ? (
            <AnalysisTab userId={userId} />
          ) : (
            <RatingView userId={userId} />
          )
        ) : tab === "list" ? (
          <SetlistTab userId={userId} />
        ) : tab === "rival" ? (
          <RivalTab userId={userId} />
        ) : (
          <StatsTab userId={userId} axis={state.axis} onAxisChange={(axis) => onStateChange({ ...state, axis })} />
        )}
      </div>
    </div>
  );
}
