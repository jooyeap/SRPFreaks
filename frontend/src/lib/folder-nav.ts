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
 * 판정 규칙을 바꿔야 하는 화면(곡 상세 이전/다음)이 넘기는 값. 안 넘기면 폴더 화면의 기본 규칙(60px, 가로가 세로보다 큼)이다.
 *  - minPx: 인정하는 가로 이동 거리(px)
 *  - maxAngleDeg: 가로축에서 이 각도 안쪽의 움직임만 인정한다(세로로 많이 비껴 쓸린 것은 스크롤로 본다)
 *  - edgePx: 화면 좌우 가장자리 이 폭 안에서 시작한 쓸기는 무시한다(브라우저의 뒤로 가기 제스처와 겹치지 않게, 시작 위치 검사는 use-swipe-nav에서 한다)
 */
export interface SwipeRules {
  minPx: number;
  maxAngleDeg?: number;
  edgePx?: number;
}

/** 곡 상세 이전/다음 곡 이동의 규칙: 가장자리 24px는 무시, 80px 이상, 가로축에서 30° 이내 */
export const DETAIL_SWIPE_RULES: SwipeRules = { minPx: 80, maxAngleDeg: 30, edgePx: 24 };

/**
 * 손가락이 (dx, dy)만큼 움직였을 때 이웃 이동으로 볼지 정한다.
 * 기본: 가로 이동이 세로 이동보다 크고 SWIPE_MIN_PX 이상일 때만 인정한다(세로 스크롤 중 살짝 비껴 쓸린 것을 이동으로 오해하지 않게).
 * rules를 주면 그 거리·각도를 쓴다(각도가 정확히 maxAngleDeg인 경계는 인정).
 * 왼쪽으로 쓸면(dx < 0) 다음 = 더 높은 난이도, 오른쪽으로 쓸면 더 낮은 난이도다(오른쪽 버튼이 높은 난이도인 것과 같은 방향).
 */
export function judgeSwipe(dx: number, dy: number, rules?: SwipeRules): SwipeDirection | null {
  const minPx = rules?.minPx ?? SWIPE_MIN_PX;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < minPx) return null;
  if (rules?.maxAngleDeg !== undefined) {
    if (ay > ax * Math.tan((rules.maxAngleDeg * Math.PI) / 180)) return null;
  } else if (ax <= ay) {
    return null;
  }
  return dx < 0 ? "higher" : "lower";
}

/**
 * 폴더 하단 알약의 진행 막대 채움 비율(0~100). 기록 수 ÷ 전체 × 100.
 * 전체가 0이거나 숫자가 아니면 0, 범위를 벗어나면 0~100으로 고정한다. 소수 셋째 자리까지만 쓴다(화면 폭용이라 그 이상은 의미 없다).
 */
export function folderProgressPercent(recorded: number, total: number): number {
  if (!Number.isFinite(recorded) || !Number.isFinite(total) || total <= 0) return 0;
  const percent = Math.min(100, Math.max(0, (recorded / total) * 100));
  return Math.round(percent * 1000) / 1000;
}
