import { describe, expect, it } from "vitest";
import { dateLabel, labelStep, layoutSeries, nearestIndex, niceScale, ratioText, signedCount } from "@/lib/dashboard";

const PAD = { left: 30, right: 10, top: 10, bottom: 20 };

describe("대시보드 보조 함수", () => {
  it("날짜 글자는 월/일이고 형식이 다르면 그대로다", () => {
    expect(dateLabel("2026-11-05")).toBe("11/05");
    expect(dateLabel("2026-11-15")).toBe("11/15");
    expect(dateLabel("어제")).toBe("어제");
  });

  it("개수 차이는 부호가 글자로 있다(진짜 마이너스 기호)", () => {
    expect(signedCount(3)).toBe("+3");
    expect(signedCount(-2)).toBe("−2");
    expect(signedCount(0)).toBe("0");
  });

  it("비율은 소수 첫째 자리이고 값이 없으면 대시다", () => {
    expect(ratioText(40)).toBe("40.0%");
    expect(ratioText(33.33)).toBe("33.3%");
    expect(ratioText(null)).toBe("–");
  });

  it("눈금은 0부터 시작하고 최대 4칸이다", () => {
    expect(niceScale(0)).toEqual({ top: 1, step: 1 });
    expect(niceScale(4)).toEqual({ top: 4, step: 1 });
    expect(niceScale(7)).toEqual({ top: 8, step: 2 });
    expect(niceScale(50)).toEqual({ top: 60, step: 20 });
    expect(niceScale(87)).toEqual({ top: 100, step: 50 });
    expect(niceScale(Number.NaN)).toEqual({ top: 1, step: 1 });
  });

  it("점 좌표: y는 0부터 시작하고 막대 높이가 값에 비례한다", () => {
    const layout = layoutSeries([0, 2, 4], 320, 176, PAD);
    // 눈금: 0..4(step 1), 바닥 y = top + innerH = 10 + 146 = 156
    expect(layout.top).toBe(4);
    expect(layout.baseline).toBe(156);
    expect(layout.ys[0]).toBeCloseTo(156, 5);          // 값 0은 바닥
    expect(layout.ys[2]).toBeCloseTo(10, 5);           // 값 4(최대)는 위쪽 끝
    expect(layout.ys[1]).toBeCloseTo(83, 5);           // 값 2는 정확히 가운데: 156 - 0.5 * 146
    expect(layout.xs[0]).toBe(30);
    expect(layout.xs[2]).toBe(310);
    expect(layout.yTicks.map((tick) => tick.value)).toEqual([0, 1, 2, 3, 4]);
  });

  it("점이 하나면 가운데에 두고 빈 목록도 그릴 수 있다", () => {
    expect(layoutSeries([5], 320, 176, PAD).xs).toEqual([170]);
    const empty = layoutSeries([], 320, 176, PAD);
    expect(empty.xs).toEqual([]);
    expect(empty.yTicks.map((tick) => tick.value)).toEqual([0, 1]);
  });

  it("누른 위치에서 가장 가까운 점을 고른다", () => {
    const xs = [30, 100, 170, 240, 310];
    expect(nearestIndex(xs, 0)).toBe(0);
    expect(nearestIndex(xs, 64)).toBe(0);
    expect(nearestIndex(xs, 66)).toBe(1);
    expect(nearestIndex(xs, 175)).toBe(2);
    expect(nearestIndex(xs, 999)).toBe(4);
    expect(nearestIndex([], 10)).toBeNull();
  });

  it("날짜 글자 간격은 최대 개수 안에 들어오게 정한다", () => {
    expect(labelStep(7, 6)).toBe(2);
    expect(labelStep(30, 6)).toBe(5);
    expect(labelStep(90, 6)).toBe(15);
    expect(labelStep(3, 6)).toBe(1);
  });
});
