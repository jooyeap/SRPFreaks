import { describe, expect, it } from "vitest";
import {
  chartScore,
  chartValue,
  guideRows,
  legendTicks,
  luminance,
  ratingConstant,
  scoreColor,
  SCORE_MAX,
  SCORE_MIN,
  textColorOn,
  TEXT_ON_DARK,
  TEXT_ON_LIGHT,
} from "@/lib/rating-guide";

// 값은 DESIGN.md 7장 / CLAUDE.md의 수식으로 직접 계산한 것이다.
describe("레이팅상수 R", () => {
  it("기준점(6.0) 위는 5×T−15, 6.0 이하는 10×T−45다", () => {
    expect(ratingConstant(70)).toBeCloseTo(20); // 5×7.0−15
    expect(ratingConstant(61)).toBeCloseTo(15.5); // 5×6.1−15
    expect(ratingConstant(60)).toBeCloseTo(15); // 경계는 low 식: 10×6.0−45 (high 식도 15라 이어진다)
    expect(ratingConstant(59)).toBeCloseTo(14); // 10×5.9−45
    expect(ratingConstant(49)).toBeCloseTo(4); // 10×4.9−45
  });
});

describe("채보 값 V와 화면 점수", () => {
  it("달성률 0/80/95/100에서 직접 계산한 값과 같다 (R=15)", () => {
    expect(chartValue(15, 0)).toBeCloseTo(0);
    expect(chartValue(15, 80)).toBeCloseTo(12); // 15×0.8
    expect(chartValue(15, 95)).toBeCloseTo(15.2); // 12 + 3.2
    expect(chartValue(15, 100)).toBeCloseTo(15.2); // 95 이상은 더 오르지 않는다
  });

  it("예시: 기준 난이도 6.0, 달성률 90% -> V 14.1333, 점수 282.67", () => {
    expect(chartValue(15, 90)).toBeCloseTo(14.1333, 4); // 12 + 3.2×10/15
    expect(chartScore(60, 90)).toBeCloseTo(282.667, 3);
  });

  it("표의 양 끝 점수가 색 범위(56~384)와 일치한다", () => {
    expect(chartScore(49, 70)).toBeCloseTo(SCORE_MIN); // R=4, 4×0.7×20
    expect(chartScore(70, 95)).toBeCloseTo(SCORE_MAX); // R=20, (16+3.2)×20
  });
});

describe("상수표 행", () => {
  const rows = guideRows();

  it("7.0부터 4.9까지 22행이고 높은 난이도가 위다", () => {
    expect(rows).toHaveLength(22);
    expect(rows[0].tier).toBe("7.0");
    expect(rows[rows.length - 1].tier).toBe("4.9");
  });

  it("내부 상수는 정수면 정수로, 아니면 소수 첫째 자리로 보인다", () => {
    expect(rows[0].constant).toBe("20");
    expect(rows.find((r) => r.tier === "6.1")?.constant).toBe("15.5");
    expect(rows.find((r) => r.tier === "6.0")?.constant).toBe("15");
  });

  it("점수는 정수로 반올림하고 달성률 열은 70~95다", () => {
    const row = rows.find((r) => r.tier === "6.0");
    expect(row?.cells.map((c) => c.rate)).toEqual([70, 75, 80, 85, 90, 95]);
    // R=15: 70% -> 10.5×20=210, 90% -> 282.67 -> 283, 95% -> 15.2×20=304
    expect(row?.cells[0].score).toBe(210);
    expect(row?.cells[4].score).toBe(283);
    expect(row?.cells[5].score).toBe(304);
  });

  it("같은 행에서는 달성률이 높을수록 점수가 줄지 않는다", () => {
    for (const row of rows) {
      const scores = row.cells.map((c) => c.score);
      expect(scores).toEqual([...scores].sort((a, b) => a - b));
    }
  });
});

describe("칸 색", () => {
  it("최소·최대 점수에서 양 끝 색이고 범위 밖은 끝 색으로 고정된다", () => {
    expect(scoreColor(SCORE_MIN)).toEqual([255, 240, 120]);
    expect(scoreColor(SCORE_MAX)).toEqual([30, 20, 30]);
    expect(scoreColor(0)).toEqual(scoreColor(SCORE_MIN));
    expect(scoreColor(999)).toEqual(scoreColor(SCORE_MAX));
  });

  it("글자색은 배경 밝기로 정하고, 표의 모든 칸에서 대비가 4.5 이상이다", () => {
    expect(textColorOn(scoreColor(SCORE_MIN))).toBe(TEXT_ON_LIGHT); // 밝은 노랑
    expect(textColorOn(scoreColor(SCORE_MAX))).toBe(TEXT_ON_DARK); // 거의 검정

    const contrast = (bg: ReturnType<typeof scoreColor>, fg: string) => {
      const fgRgb: [number, number, number] = fg === TEXT_ON_DARK ? [255, 255, 255] : [0, 0, 0];
      const [hi, lo] = [luminance(bg), luminance(fgRgb)].sort((a, b) => b - a);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const row of guideRows()) {
      for (const cell of row.cells) {
        const bg = scoreColor(cell.score);
        expect(contrast(bg, textColorOn(bg))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("범례 눈금은 최소~최대를 7칸으로 나눈다", () => {
    const ticks = legendTicks();
    expect(ticks).toHaveLength(7);
    expect(ticks[0]).toBe(SCORE_MIN);
    expect(ticks[6]).toBe(SCORE_MAX);
  });
});
