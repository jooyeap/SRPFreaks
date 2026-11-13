import type { ChartFolderListResponse } from "@/lib/api-types";
import type { StageCounts } from "@/components/table/StageBar";
import type { StatsAxis } from "@/lib/rate-folders";
import type { MessageKey } from "@/i18n/translator";

/**
 * 마이페이지 상위 탭(D75). 주소 쿼리(`/me?tab=stats`)에 두어 새로고침·뒤로가기·링크 공유에도 같은 탭이 열린다.
 * 탭이 다섯 개(레이팅·통계·세트리스트·라이벌·분석)일 때 360px에서 옆으로 밀어야 했고 「내 리스트」까지 들어오면 여섯 개가 되어,
 * 상위 탭은 네 개로 두고 비슷한 것은 탭 안의 하위 전환(`MyPageSubView`)으로 묶는다.
 */
export type MyPageTab = "rating" | "stats" | "list" | "rival";

/**
 * 하위 전환 값. 주소의 `view`에 쓴다. 각 탭의 첫 항목(기본)은 `null`이라 주소에 쓰지 않는다(`?tab=rating`이 「내 레이팅」, `?tab=rating&view=analysis`가 「분석」).
 * 「내 리스트」가 생기면 여기에 값을 더하고 `MY_PAGE_SUB_VIEWS.list`에 항목을 추가하면 리스트 탭에 하위 전환이 저절로 나타난다.
 */
export type MyPageSubView = "analysis";

export const MY_PAGE_TABS: readonly { value: MyPageTab; labelKey: MessageKey }[] = [
  { value: "rating", labelKey: "MyPage.tabRating" },
  { value: "stats", labelKey: "MyPage.tabStats" },
  { value: "list", labelKey: "MyPage.tabList" },
  { value: "rival", labelKey: "MyPage.tabRival" },
];

export interface MyPageSubViewItem {
  /** 기본(첫) 항목은 null */
  value: MyPageSubView | null;
  labelKey: MessageKey;
}

/**
 * 탭별 하위 전환 항목. **항목이 2개 이상인 탭에만** 하위 전환을 그린다(`hasSubViews`). 지금은 레이팅 탭(내 레이팅 · 분석)만 해당하고,
 * 리스트 탭은 세트리스트 하나뿐이라 그리지 않는다.
 */
export const MY_PAGE_SUB_VIEWS: Record<MyPageTab, readonly MyPageSubViewItem[]> = {
  rating: [
    { value: null, labelKey: "Rating.mine" },
    { value: "analysis", labelKey: "MyPage.tabAnalysis" },
  ],
  stats: [],
  list: [{ value: null, labelKey: "MyPage.tabSetlist" }],
  rival: [],
};

export function hasSubViews(items: readonly MyPageSubViewItem[]): boolean {
  return items.length >= 2;
}

/** 알 수 없는 값(주소는 사용자가 고칠 수 있다)은 기본 탭(레이팅)으로 본다. 옛 값 `setlist`는 리스트, `analysis`는 레이팅 탭의 분석으로 읽는다. */
export function tabFromParam(value: string | null): MyPageTab {
  if (value === "stats" || value === "list" || value === "rival") return value;
  if (value === "setlist") return "list";
  return "rating";
}

/** 마이페이지의 화면 상태: 탭, 탭 안의 하위 전환(기본은 null), 통계 탭의 기준(레벨 폴더 / 서열표 난이도). */
export interface MyPageState {
  tab: MyPageTab;
  axis: StatsAxis;
  view: MyPageSubView | null;
}

export const DEFAULT_MY_PAGE_STATE: MyPageState = { tab: "rating", axis: "level", view: null };

/** 그 탭에 실제로 있는 하위 전환만 인정한다(예: `?tab=stats&view=analysis`의 view는 버린다). */
function viewFor(tab: MyPageTab, value: string | null): MyPageSubView | null {
  const found = MY_PAGE_SUB_VIEWS[tab].find((item) => item.value !== null && item.value === value);
  return found?.value ?? null;
}

export function myPageStateFromParams(params: URLSearchParams): MyPageState {
  const rawTab = params.get("tab");
  const axis = params.get("axis") === "tier" ? "tier" : "level";
  // 옛 주소 ?tab=analysis는 「레이팅 탭의 분석」으로 읽는다
  if (rawTab === "analysis") return { tab: "rating", axis, view: "analysis" };
  const tab = tabFromParam(rawTab);
  return { tab, axis, view: viewFor(tab, params.get("view")) };
}

/**
 * 옛 주소(?tab=setlist, ?tab=analysis)인지. 화면은 이 주소도 같은 탭으로 읽지만(myPageStateFromParams),
 * 주소창에는 새 주소로 바꿔 두려고(replace) 화면 쪽에서 이 값을 본다.
 */
export function isLegacyMyPageQuery(params: URLSearchParams): boolean {
  const tab = params.get("tab");
  return tab === "setlist" || tab === "analysis";
}

/** 기본값(레이팅 탭, 레벨 폴더, 기본 하위 전환)은 주소에 쓰지 않는다. 기준(axis)은 통계 탭일 때만, view는 그 탭에 있는 하위 전환일 때만 쓴다. */
export function myPageStateToQuery(state: MyPageState): string {
  const params = new URLSearchParams();
  if (state.tab !== "rating") params.set("tab", state.tab);
  if (state.tab === "stats" && state.axis === "tier") params.set("axis", "tier");
  const view = viewFor(state.tab, state.view);
  if (view) {
    if (state.tab === "rating") params.set("tab", "rating"); // ?tab=rating&view=analysis 처럼 탭을 먼저 쓴다
    params.set("view", view);
  }
  return params.toString();
}

export interface OverallStages extends StageCounts {
  total: number;
  recorded: number;
}

/**
 * 전체 곡 목록 폴더(서버가 계산한 칩 개수)를 모두 합쳐 전체 달성 현황을 만든다.
 * 서버가 이미 단계(EXC/FC/SS/S/S 미만)로 나눈 값이라 화면에서 다시 판정하지 않고 더하기만 한다.
 */
export function overallStages(list: ChartFolderListResponse): OverallStages {
  const sum: OverallStages = { exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, total: 0, recorded: 0 };
  for (const f of list.folders) {
    sum.exc += f.exc;
    sum.fc += f.fc;
    sum.ss += f.ss;
    sum.s += f.s;
    sum.belowS += f.belowS;
    sum.total += f.total;
    sum.recorded += f.recorded;
  }
  return sum;
}
