import { describe, expect, it } from "vitest";
import ko from "../../messages/ko.json";
import {
  averageText,
  bestRateText,
  chartKindText,
  chartStatsHref,
  deviationBarPercent,
  layoutCurve,
  ratioPercent,
  signedText,
  tierText,
  type FolderRow,
} from "@/lib/chart-stats";

describe("편차·평균 표시", () => {
  it("편차는 부호가 글자로 같이 있다(색에 기대지 않는다)", () => {
    expect(signedText(15)).toBe("+15.00%p");
    expect(signedText(-18.333333)).toBe("−18.33%p");
    expect(signedText(8.3333)).toBe("+8.33%p");
    expect(signedText(0)).toBe("0.00%p");
    // 반올림하면 0이 되는 값은 부호 없이 0
    expect(signedText(0.004)).toBe("0.00%p");
    expect(signedText(-0.004)).toBe("0.00%p");
    expect(signedText(null)).toBeNull();
  });

  it("평균은 둘째 자리까지, 값이 없으면 null(화면이 표본 부족을 쓴다)", () => {
    expect(averageText(87.12)).toBe("87.12%");
    expect(averageText(100)).toBe("100.00%");
    expect(averageText(null)).toBeNull();
  });

  it("유저 한 명의 최고 달성률은 100.00이면 MAX", () => {
    expect(bestRateText(100)).toBe("MAX");
    expect(bestRateText(93.456)).toBe("93.46%");
  });

  it("기준 난이도는 소수 첫째 자리, 없으면 null(미정)", () => {
    expect(tierText(6)).toBe("6.0");
    expect(tierText(5.8)).toBe("5.8");
    expect(tierText(null)).toBeNull();
  });

  it("파트와 난이도가 한 덩어리인 글자", () => {
    expect(chartKindText({ part: "GUITAR", difficulty: "MASTER", level: 9.5 })).toBe("Guitar | MAS 9.50");
    expect(chartKindText({ part: "BASS", difficulty: "EXTREME", level: 8.25 })).toBe("Bass | EXT 8.25");
  });

  it("상세 화면 주소", () => {
    expect(chartStatsHref(12)).toBe("/admin/chart-stats/12");
  });
});

describe("막대 길이(장식)", () => {
  it("편차 막대는 ±10%p에서 한쪽이 가득 차고 그 밖은 끝에 모은다", () => {
    expect(deviationBarPercent(0)).toBe(0);
    expect(deviationBarPercent(5)).toBe(50);
    expect(deviationBarPercent(-5)).toBe(50);
    expect(deviationBarPercent(10)).toBe(100);
    expect(deviationBarPercent(-25)).toBe(100);
    expect(deviationBarPercent(null)).toBe(0);
    expect(deviationBarPercent(Number.NaN)).toBe(0);
  });

  it("비율 막대는 최댓값 대비 0~100", () => {
    expect(ratioPercent(5, 10)).toBe(50);
    expect(ratioPercent(10, 10)).toBe(100);
    expect(ratioPercent(3, 0)).toBe(0);
    expect(ratioPercent(-1, 10)).toBe(0);
  });
});

function folder(tier: number, avg: number | null): FolderRow {
  return { tier, chartCount: 5, sampledCharts: avg === null ? 1 : 4, avgRate: avg, deltaFromPrevious: null };
}

describe("폴더 곡선 배치", () => {
  const pad = { left: 30, right: 10, top: 10, bottom: 20 };

  it("점이 없으면 빈 배치다", () => {
    expect(layoutCurve([], 320, 190, pad).points).toEqual([]);
    expect(layoutCurve([folder(5.8, null)], 320, 190, pad).points).toEqual([]);
  });

  it("표본 부족 폴더는 점이 없고 선이 거기서 끊긴다(건너뜀)", () => {
    const layout = layoutCurve([folder(5.8, 80), folder(5.9, 82), folder(6.0, null), folder(6.1, 70), folder(6.2, 72)], 320, 190, pad);

    expect(layout.points.map((p) => p.tier)).toEqual([5.8, 5.9, 6.1, 6.2]);
    expect(layout.segments).toHaveLength(2);
    expect(layout.segments[0].map((p) => p.tier)).toEqual([5.8, 5.9]);
    expect(layout.segments[1].map((p) => p.tier)).toEqual([6.1, 6.2]);
    // x는 표본 부족 폴더 자리도 같은 간격으로 남긴다: 5칸 → 4등분
    expect(layout.xs).toHaveLength(5);
    expect(layout.xs[0]).toBe(30);
    expect(layout.xs[4]).toBe(310);
    expect(layout.xs[2]).toBe(170);
  });

  it("y축은 5의 배수로 맞추고 값이 클수록 위(작은 y)에 놓인다", () => {
    const layout = layoutCurve([folder(5.8, 78), folder(5.9, 91)], 320, 190, pad);

    expect(layout.min).toBe(75);
    expect(layout.max).toBe(95);
    expect(layout.yTicks.map((t) => t.value)).toEqual([75, 80, 85, 90, 95]);
    const [low, high] = layout.points;
    expect(high.y).toBeLessThan(low.y);
    // 맨 위 눈금(95)은 위쪽 여백, 맨 아래 눈금(75)은 아래쪽 여백에 닿는다
    expect(layout.yTicks[4].y).toBe(10);
    expect(layout.yTicks[0].y).toBe(170);
  });

  it("폴더가 하나면 가운데에 놓는다", () => {
    const layout = layoutCurve([folder(6.0, 80)], 320, 190, pad);
    expect(layout.points).toHaveLength(1);
    expect(layout.points[0].x).toBe(30 + 140);
  });
});

describe("번역 문구에는 판정이 없다", () => {
  // 쉬움/어려움 후보, 역전, 적정, 경고 같은 판정·라벨을 만들지 않는다. 안내문이 "판정하지 않는다"고 말하는 문장만 예외다.
  const JUDGMENT = /(후보|역전|적정|경고|쉬운|쉬움|어려운|어려움|너무)/;
  const stats = ko.ChartStats as Record<string, string>;

  it("서열표 분석 문구 어디에도 판정 단어가 없다(집계 기준 안내의 부정문만 예외)", () => {
    for (const [key, text] of Object.entries(stats)) {
      if (key === "helpBody") {
        // 이 안내문은 "쉬움·어려움 같은 판정은 하지 않습니다"라고 부정문으로만 말한다
        expect(text).toContain("판정은 하지 않습니다");
        continue;
      }
      expect(text, key).not.toMatch(JUDGMENT);
    }
  });
});
