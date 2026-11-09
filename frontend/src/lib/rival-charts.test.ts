import { describe, expect, it } from "vitest";
import type { RivalPatternSummary } from "@/lib/api-types";
import {
  clampDiff,
  DOT_RANGE,
  DOT_TICKS,
  dotX,
  diffSide,
  labelAnchor,
  layoutDots,
  polarPoint,
  radarAxes,
  ringPoints,
  dataPoints,
  winRate,
  winRatePercent,
} from "@/lib/rival-charts";

function pattern(key: RivalPatternSummary["key"], over: Partial<RivalPatternSummary> = {}): RivalPatternSummary {
  return { pattern: key, key, wins: 0, ties: 0, losses: 0, scoreDiffSum: 0, closeCount: 0, sharedCount: 0, ...over };
}

describe("점 분포 좌표", () => {
  it("눈금은 −10, −5, 0, +5, +10이다", () => {
    expect(DOT_TICKS).toEqual([-10, -5, 0, 5, 10]);
    expect(DOT_RANGE).toBe(10);
  });

  it("점수 차를 −10 ~ +10으로 자른다(경계 ±10, ±10.01, 아주 큰 값)", () => {
    expect(clampDiff(10)).toBe(10);
    expect(clampDiff(-10)).toBe(-10);
    expect(clampDiff(10.01)).toBe(10);
    expect(clampDiff(-10.01)).toBe(-10);
    expect(clampDiff(1e9)).toBe(10);
    expect(clampDiff(-1e9)).toBe(-10);
    expect(clampDiff(0)).toBe(0);
  });

  it("가로 좌표: −10은 왼쪽 끝, 0은 가운데, +10은 오른쪽 끝이고 범위 밖은 끝에 붙는다", () => {
    expect(dotX(-10, 200)).toBe(0);
    expect(dotX(0, 200)).toBe(100);
    expect(dotX(10, 200)).toBe(200);
    expect(dotX(-25, 200)).toBe(0);
    expect(dotX(25, 200)).toBe(200);
    expect(dotX(5, 200)).toBe(150);
  });

  it("점의 뜻: 접전 폭(±1, 경계 포함) 안은 접전, 밖에서 양수는 우세·음수는 열세", () => {
    expect(diffSide(1, 1)).toBe("close");
    expect(diffSide(-1, 1)).toBe("close");
    expect(diffSide(0, 1)).toBe("close");
    expect(diffSide(1.01, 1)).toBe("win");
    expect(diffSide(-1.01, 1)).toBe("lose");
    expect(diffSide(8, 1)).toBe("win");
  });
});

describe("점 배치", () => {
  const options = { width: 200, radius: 3, halfHeight: 15 };

  it("0곡이면 점이 없다", () => {
    expect(layoutDots([], options)).toEqual([]);
  });

  it("1곡이면 점 하나가 줄 가운데(세로 어긋남 0)에 놓인다", () => {
    const dots = layoutDots([2.5], options);
    expect(dots).toHaveLength(1);
    expect(dots[0]).toMatchObject({ x: dotX(2.5, 200), dy: 0, diff: 2.5, clamped: false });
  });

  it("범위 밖(±10 초과)은 끝에 붙고 clamped로 표시된다. 정확히 ±10은 clamped가 아니다", () => {
    const dots = layoutDots([-30, -10, 10, 10.01], options);
    expect(dots.map((d) => d.x)).toEqual([0, 0, 200, 200]);
    expect(dots.map((d) => d.clamped)).toEqual([true, false, false, true]);
  });

  it("같은 자리에 겹치는 점은 세로로 어긋나게 놓고 줄 높이 안에 머문다", () => {
    const dots = layoutDots([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], options);
    const offsets = dots.map((d) => d.dy);
    expect(offsets[0]).toBe(0);
    expect(new Set(offsets).size).toBeGreaterThan(1);
    for (const dy of offsets) expect(Math.abs(dy) + options.radius).toBeLessThanOrEqual(options.halfHeight + 1e-9);
  });

  it("배치는 결정적이다: 같은 입력(순서가 달라도)이면 같은 결과", () => {
    const a = layoutDots([3, 1, 1, -4, 1, 9, 3], options);
    const b = layoutDots([9, 1, 3, 1, -4, 3, 1], options);
    expect(a).toEqual(b);
    expect(layoutDots([3, 1, 1, -4, 1, 9, 3], options)).toEqual(a);
  });

  it("숫자가 아닌 값은 건너뛴다", () => {
    const dots = layoutDots([1, Number.NaN, Number.POSITIVE_INFINITY, 2], options);
    expect(dots.map((d) => d.diff)).toEqual([1, 2]);
  });
});

describe("레이더", () => {
  it("승률 = 승 ÷ 공유 곡(무·패 포함). 공유 곡이 없으면 null(0%가 아니다)", () => {
    expect(winRate({ wins: 3, sharedCount: 6 })).toBe(0.5);
    expect(winRate({ wins: 0, sharedCount: 4 })).toBe(0);
    expect(winRate({ wins: 4, sharedCount: 4 })).toBe(1);
    expect(winRate({ wins: 0, sharedCount: 0 })).toBeNull();
  });

  it("대시보드의 승률 %는 레이더와 같은 정수 반올림이고, 공유 곡이 없으면 null이다", () => {
    expect(winRatePercent({ wins: 6, sharedCount: 9 })).toBe(67); // 66.67
    expect(winRatePercent({ wins: 1, sharedCount: 6 })).toBe(17); // 16.67
    expect(winRatePercent({ wins: 1, sharedCount: 8 })).toBe(13); // 12.5 → 반올림
    expect(winRatePercent({ wins: 0, sharedCount: 5 })).toBe(0);
    expect(winRatePercent({ wins: 5, sharedCount: 5 })).toBe(100);
    expect(winRatePercent({ wins: 0, sharedCount: 0 })).toBeNull();
    // 레이더 축의 percent와 같은 값이다
    expect(radarAxes([pattern("SINGLE", { wins: 6, sharedCount: 9 })])[0].percent).toBe(winRatePercent({ wins: 6, sharedCount: 9 }));
  });

  it("축은 맨 위(−90°)에서 시계 방향으로 360/5씩 놓인다", () => {
    const axes = radarAxes(["SINGLE", "COMPOUND", "COMPOSITE_SINGLE", "DOUBLE", "TRIPLE"].map((k) => pattern(k as RivalPatternSummary["key"])));
    expect(axes.map((a) => a.angle)).toEqual([-90, -18, 54, 126, 198]);
  });

  it("승률 0 / 50 / 100%와 5곡 미만·공유 곡 없음을 구분한다", () => {
    const axes = radarAxes([
      pattern("SINGLE", { wins: 0, losses: 6, sharedCount: 6 }),
      pattern("COMPOUND", { wins: 3, losses: 3, sharedCount: 6 }),
      pattern("COMPOSITE_SINGLE", { wins: 6, sharedCount: 6 }),
      pattern("DOUBLE", { wins: 2, losses: 2, sharedCount: 4 }),
      pattern("TRIPLE"),
    ]);
    expect(axes.map((a) => a.percent)).toEqual([0, 50, 100, 50, null]);
    expect(axes.map((a) => a.radiusRatio)).toEqual([0, 0.5, 1, 0.5, 0.5]);
    expect(axes.map((a) => a.small)).toEqual([false, false, false, true, true]);
  });

  it("승률 %는 정수로 반올림한다", () => {
    const [axis] = radarAxes([pattern("SINGLE", { wins: 1, losses: 2, sharedCount: 3 })]);
    expect(axis.percent).toBe(33);
  });

  it("꼭짓점 좌표: 맨 위 축은 중심 바로 위, 반지름 비율이 그대로 곱해진다", () => {
    const top = polarPoint(100, 100, 50, -90);
    expect(top.x).toBeCloseTo(100, 6);
    expect(top.y).toBeCloseTo(50, 6);
    const right = polarPoint(100, 100, 50, 0);
    expect(right.x).toBeCloseTo(150, 6);
    expect(right.y).toBeCloseTo(100, 6);
  });

  it("링과 데이터 다각형 좌표: 다섯 점이고 0%는 중심, 100%는 바깥 원 위이다", () => {
    const axes = radarAxes([
      pattern("SINGLE", { wins: 0, losses: 5, sharedCount: 5 }),
      pattern("COMPOUND", { wins: 5, sharedCount: 5 }),
      pattern("COMPOSITE_SINGLE", { wins: 5, sharedCount: 5 }),
      pattern("DOUBLE", { wins: 5, sharedCount: 5 }),
      pattern("TRIPLE", { wins: 5, sharedCount: 5 }),
    ]);
    const outer = ringPoints(axes, 100, 100, 50, 1).split(" ");
    expect(outer).toHaveLength(5);
    expect(outer[0]).toBe("100,50");
    const data = dataPoints(axes, 100, 100, 50).split(" ");
    expect(data[0]).toBe("100,100"); // 승률 0% = 중심
    expect(data[1]).toBe(outer[1]); // 승률 100% = 바깥 원
  });

  it("꼭짓점 글자 맞춤: 왼쪽은 end, 오른쪽은 start, 위·아래는 middle", () => {
    expect(labelAnchor(-90)).toBe("middle");
    expect(labelAnchor(-18)).toBe("start");
    expect(labelAnchor(198)).toBe("end");
    expect(labelAnchor(54)).toBe("start");
    expect(labelAnchor(126)).toBe("end");
  });

  it("축이 없으면 빈 목록이다", () => {
    expect(radarAxes([])).toEqual([]);
  });
});
