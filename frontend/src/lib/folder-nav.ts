import type { TierGroupResponse } from "@/lib/api-types";

/**
 * 서열표 폴더 화면의 이웃 난이도 이동 계산(화면 아래 버튼과 좌우 스와이프가 같이 쓴다).
 * groups는 서버 순서(높은 난이도 먼저)다. 화면은 왼쪽이 낮은 난이도, 오른쪽이 높은 난이도다.
 */
export interface FolderNeighbors {
  /** 바로 아래 난이도(왼쪽 버튼 / 오른쪽으로 쓸기). 가장 낮으면 null */
  lower: TierGroupResponse | null;
  /** 바로 위 난이도(오른쪽 버튼 / 왼쪽으로 쓸기). 가장 높으면 null */
  higher: TierGroupResponse | null;
}

export function neighborGroups(groups: readonly TierGroupResponse[], currentTier: number | null): FolderNeighbors {
  const index = groups.findIndex((g) => g.tier === currentTier);
  if (index < 0) return { lower: null, higher: null };
  return {
    higher: index > 0 ? groups[index - 1] : null, // 서버 순서에서 앞 = 더 높은 난이도
    lower: index < groups.length - 1 ? groups[index + 1] : null,
  };
}

/** 스와이프로 인정하는 가로 이동 거리(px). 이보다 짧으면 스크롤·탭으로 본다. */
export const SWIPE_MIN_PX = 60;

export type SwipeDirection = "lower" | "higher";

/**
 * 손가락이 (dx, dy)만큼 움직였을 때 이웃 이동으로 볼지 정한다.
 * 가로 이동이 세로 이동보다 크고 SWIPE_MIN_PX 이상일 때만 인정한다(세로 스크롤 중 살짝 비껴 쓸린 것을 이동으로 오해하지 않게).
 * 왼쪽으로 쓸면(dx < 0) 다음 = 더 높은 난이도, 오른쪽으로 쓸면 더 낮은 난이도다(오른쪽 버튼이 높은 난이도인 것과 같은 방향).
 */
export function judgeSwipe(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? "higher" : "lower";
}
