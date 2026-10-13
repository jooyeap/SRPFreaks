import type { ChartFolderListResponse } from "@/lib/api-types";
import type { StageCounts } from "@/components/table/StageBar";

/** 마이페이지 탭. 주소 쿼리(`/me?tab=stats`)에 두어 새로고침·뒤로가기·링크 공유에도 같은 탭이 열린다. */
export type MyPageTab = "rating" | "stats";

export const MY_PAGE_TABS: readonly { value: MyPageTab; label: string }[] = [
  { value: "rating", label: "레이팅" },
  { value: "stats", label: "통계" },
];

/** 알 수 없는 값(주소는 사용자가 고칠 수 있다)은 기본 탭(레이팅)으로 본다. */
export function tabFromParam(value: string | null): MyPageTab {
  return value === "stats" ? "stats" : "rating";
}

/** 기본 탭은 주소에 쓰지 않는다(`/me`). */
export function tabToQuery(tab: MyPageTab): string {
  return tab === "stats" ? "tab=stats" : "";
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
