import type { RivalPatternSummary } from "@/lib/api-types";
import { SMALL_SAMPLE_LIMIT } from "@/lib/rival-dashboard";

/**
 * 라이벌 대시보드(D67, 7단계)의 점 분포·레이더 좌표 계산. SVG를 그리는 쪽(컴포넌트)은 여기서 받은 숫자만 쓴다.
 * 승·무·패·접전은 서버가 센 값이고(화면에서 다시 세지 않는다), 이 파일은 그 값을 좌표로 바꾸는 일만 한다.
 * 모든 계산은 결정적이다(난수 없음): 같은 입력은 새로고침해도 같은 그림이 나온다.
 */

// ── 점 분포 ────────────────────────────────────────────────────────────────

/** 가로 축은 점수 차 −10 ~ +10이다. 범위 밖은 끝에 붙인다. */
export const DOT_RANGE = 10;

/** 눈금(−10, −5, 0, +5, +10). */
export const DOT_TICKS: readonly number[] = [-10, -5, 0, 5, 10];

/** 점수 차를 −10 ~ +10으로 자른다. */
export function clampDiff(diff: number): number {
  if (diff > DOT_RANGE) return DOT_RANGE;
  if (diff < -DOT_RANGE) return -DOT_RANGE;
  return diff;
}

/** 점수 차를 가로 좌표(0 ~ width)로 바꾼다. −10이 0, 0이 가운데, +10이 width. */
export function dotX(diff: number, width: number): number {
  return ((clampDiff(diff) + DOT_RANGE) / (DOT_RANGE * 2)) * width;
}

export type DotSide = "win" | "lose" | "close";

/**
 * 점의 의미: 접전 폭(±closeMargin, 경계 포함) 안은 접전, 그 밖에서 양수는 우세, 음수는 열세.
 * 서버의 접전 기준(`closeMargin`)을 그대로 받는다. 색뿐 아니라 가로 위치(왼쪽 열세·오른쪽 우세)로도 같은 뜻이 전해진다.
 */
export function diffSide(diff: number, closeMargin: number): DotSide {
  if (Math.abs(diff) <= closeMargin) return "close";
  return diff > 0 ? "win" : "lose";
}

export interface Dot {
  /** 그릴 가로 좌표(0 ~ width) */
  x: number;
  /** 줄 가운데(0)에서 위(−)·아래(+)로 어긋난 세로 거리 */
  dy: number;
  /** 원래 점수 차(자르기 전) */
  diff: number;
  /** −10 ~ +10을 넘어 끝에 붙었는지 */
  clamped: boolean;
}

/**
 * 점들을 줄 안에 놓는다. 가까운 점끼리는 같은 칸(점 지름 폭)에 묶어, 칸 안에서 차례로 가운데 → 아래 → 위 → 더 아래… 로 어긋나게 한다.
 * 정렬한 순서로 칸에 넣으므로 같은 입력이면 항상 같은 배치다. 줄 높이를 넘으면 처음 자리로 되돌아가(겹치지만 줄 밖으로는 나가지 않는다).
 * 숫자가 아닌 값(NaN·Infinity)은 건너뛴다.
 */
export function layoutDots(diffs: readonly number[], options: { width: number; radius: number; halfHeight: number }): Dot[] {
  const { width, radius, halfHeight } = options;
  const step = radius * 1.7;
  const maxLevel = Math.max(0, Math.floor((halfHeight - radius) / step));
  const slots = maxLevel * 2 + 1; // 가운데 + 위아래 maxLevel칸씩
  const columnWidth = Math.max(radius * 2, 1);
  const counts = new Map<number, number>();
  const sorted = diffs.filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
  return sorted.map((diff) => {
    const x = dotX(diff, width);
    const column = Math.round(x / columnWidth);
    const k = counts.get(column) ?? 0;
    counts.set(column, k + 1);
    const slot = k % slots;
    const level = Math.ceil(slot / 2);
    const dy = slot === 0 ? 0 : (slot % 2 === 1 ? 1 : -1) * level * step;
    return { x, dy, diff, clamped: Math.abs(diff) > DOT_RANGE };
  });
}

// ── 레이더 ────────────────────────────────────────────────────────────────

export interface RadarAxis {
  key: string;
  /** 속성 라벨(서버가 준 한글 라벨. 화면에서 patternLabel로 번역한다) */
  pattern: string;
  /** 승률 0~1. 공유 곡이 없으면 null */
  rate: number | null;
  /** 승률을 정수 %로(없으면 null) */
  percent: number | null;
  sharedCount: number;
  /** 공유 곡이 5곡 미만이면 참고용(점을 비운다) */
  small: boolean;
  /** 이 축의 각도(도). 맨 위가 −90, 시계 방향으로 늘어난다 */
  angle: number;
  /** 점을 찍을 반지름 비율 0~1(승률, 공유 곡이 없으면 동률 0.5로 둔다) */
  radiusRatio: number;
}

/** 승률 = 승 / 공유 곡(무·패 포함 전체). 공유 곡이 없으면 null(0%가 아니다). */
export function winRate(pattern: Pick<RivalPatternSummary, "wins" | "sharedCount">): number | null {
  if (pattern.sharedCount <= 0) return null;
  return Math.min(1, Math.max(0, pattern.wins / pattern.sharedCount));
}

/** 화면에 쓰는 정수 승률 %(레이더와 같은 Math.round). 공유 곡이 없으면 null(0%가 아니다). 속성별 값은 대시보드의 카드·막대·상세 줄이 모두 이 값을 쓴다. */
export function winRatePercent(pattern: Pick<RivalPatternSummary, "wins" | "sharedCount">): number | null {
  const rate = winRate(pattern);
  return rate === null ? null : Math.round(rate * 100);
}

/** 속성 줄들을 레이더의 축으로 바꾼다. 축은 서버가 준 순서대로 맨 위부터 시계 방향이다. */
export function radarAxes(patterns: readonly RivalPatternSummary[]): RadarAxis[] {
  const n = Math.max(patterns.length, 1);
  return patterns.map((p, i) => {
    const rate = winRate(p);
    return {
      key: p.key,
      pattern: p.pattern,
      rate,
      percent: rate === null ? null : Math.round(rate * 100),
      sharedCount: p.sharedCount,
      small: p.sharedCount < SMALL_SAMPLE_LIMIT,
      angle: -90 + (360 / n) * i,
      // 공유 곡이 없는 축은 0%가 아니라 동률 자리에 빈 원만 둔다(다각형이 한쪽으로 찌그러지지 않게)
      radiusRatio: rate ?? 0.5,
    };
  });
}

export interface Point {
  x: number;
  y: number;
}

/** 중심(cx, cy)에서 각도(도)와 반지름 방향의 점. */
export function polarPoint(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/** 소수 둘째 자리까지 반올림한 좌표 글자(`x,y`). 부동소수점 찌꺼기가 값 검사를 흔들지 않게 한다. */
function fmt(point: Point): string {
  const r = (v: number) => Math.round(v * 100) / 100;
  return `${r(point.x)},${r(point.y)}`;
}

/** 모든 축의 같은 비율(1이면 바깥 원, 0.5면 동률 점선) 위 점을 이은 다각형 좌표 글자. */
export function ringPoints(axes: readonly RadarAxis[], cx: number, cy: number, radius: number, ratio: number): string {
  return axes.map((a) => fmt(polarPoint(cx, cy, radius * ratio, a.angle))).join(" ");
}

/** 승률 다각형 좌표 글자. */
export function dataPoints(axes: readonly RadarAxis[], cx: number, cy: number, radius: number): string {
  return axes.map((a) => fmt(polarPoint(cx, cy, radius * a.radiusRatio, a.angle))).join(" ");
}

/** 축 끝 글자를 놓을 쪽: 왼쪽 축은 오른쪽 끝 맞춤, 오른쪽 축은 왼쪽 끝 맞춤, 위·아래 가까운 축은 가운데. */
export function labelAnchor(angleDeg: number): "start" | "middle" | "end" {
  const cos = Math.cos((angleDeg * Math.PI) / 180);
  if (Math.abs(cos) < 0.25) return "middle";
  return cos > 0 ? "start" : "end";
}
