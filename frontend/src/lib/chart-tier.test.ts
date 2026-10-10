import { describe, expect, it } from "vitest";
import { chartTier, chartTierAttrs, chartTierStart, PLAYER_TIER_MINS, previewScore, ratedScore } from "@/lib/chart-tier";

describe("chartTierStart", () => {
  it("티어 최소 점수를 40으로 나눈다 (하수봉 9500 -> 237.5)", () => {
    expect(chartTierStart(9500)).toBe(237.5);
    expect(chartTierStart(500)).toBe(12.5);
    expect(chartTierStart(0)).toBe(0);
  });

  it("티어는 20단계이고 최소 점수가 오름차순이다", () => {
    expect(PLAYER_TIER_MINS).toHaveLength(20);
    const mins = PLAYER_TIER_MINS.map((t) => t.min);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
  });
});

describe("chartTier", () => {
  it("경계: 시작점 바로 아래는 아래 티어, 시작점부터 위 티어", () => {
    expect(chartTier(12.49).key).toBe("WHITE");
    expect(chartTier(12.5).key).toBe("WHITE_GRADIENT");
    expect(chartTier(237.49).key).toBe("RAINBOW_GRADIENT");
    expect(chartTier(237.5).key).toBe("HASUBONG");
  });

  it("0점과 음수는 가장 낮은 티어다", () => {
    expect(chartTier(0).key).toBe("WHITE");
    expect(chartTier(-5).key).toBe("WHITE");
  });

  it("최고 티어 아래에서는 빛 단계가 없다", () => {
    expect(chartTier(237.49).glow).toBe(0);
    expect(chartTier(160).glow).toBe(0);
  });

  it("최고 티어에서는 25점마다 단계가 오른다 (237.5 → 1, 262.5 → 2, … 362.5 → 6)", () => {
    expect(chartTier(237.5).glow).toBe(1);
    expect(chartTier(262.49).glow).toBe(1);
    expect(chartTier(262.5).glow).toBe(2);
    expect(chartTier(287.5).glow).toBe(3);
    expect(chartTier(304).glow).toBe(3);
    expect(chartTier(312.5).glow).toBe(4);
    expect(chartTier(337.5).glow).toBe(5);
    expect(chartTier(362.49).glow).toBe(5);
    expect(chartTier(362.5).glow).toBe(6);
    expect(chartTier(384).glow).toBe(6);
    expect(chartTier(500).glow).toBe(6); // 더 올라가도 6단계에서 멈춘다
  });

  it("상수표의 직접 계산한 예시 칸", () => {
    expect(chartTier(160).key).toBe("RED"); // 5.5, 80%
    expect(chartTier(181.33).key).toBe("BRONZE"); // 5.5, 85%
    expect(chartTier(202.67).key).toBe("GOLD"); // 5.5, 90%
    expect(chartTier(224).key).toBe("RAINBOW"); // 5.5, 95%
    expect(chartTier(80).key).toBe("GREEN"); // 5.0, 80%
  });
});

describe("chartTierAttrs", () => {
  it("빛이 없으면 data-glow를 붙이지 않는다", () => {
    expect(chartTierAttrs(80)).toEqual({ "data-tier": "GREEN" });
  });

  it("빛이 있으면 단계를 문자열로 붙인다", () => {
    expect(chartTierAttrs(384)).toEqual({ "data-tier": "HASUBONG", "data-glow": "6" });
  });
});

describe("previewScore", () => {
  it("레이팅 상수 난이도와 달성률로 점수를 구한다 (직접 계산: 7.0/95% = 384, 6.0/95% = 304, 5.5/80% = 160)", () => {
    expect(previewScore(7.0, 95)).toBeCloseTo(384, 6);
    expect(previewScore(6.0, 95)).toBeCloseTo(304, 6);
    expect(previewScore(5.5, 80)).toBeCloseTo(160, 6);
  });

  it("95%를 넘어도 가산점은 더 오르지 않는다", () => {
    expect(previewScore(7.0, 100)).toBeCloseTo(384, 6);
  });

  it("미정이거나 달성률이 범위 밖이면 null", () => {
    expect(previewScore(null, 90)).toBeNull();
    expect(previewScore(6.0, -0.01)).toBeNull();
    expect(previewScore(6.0, 100.01)).toBeNull();
    expect(previewScore(6.0, Number.NaN)).toBeNull();
  });
});

describe("ratedScore", () => {
  const ok = { ratingEnabled: true, pattern: "단일" };
  it("레이팅 대상이면 previewScore와 같은 값이다", () => {
    expect(ratedScore(5.8, 96.5, ok)).toBe(272);
  });
  it("기록 없음, 반영 꺼짐, 속성 없음·`레이팅 제외`, 미정이면 null", () => {
    expect(ratedScore(5.8, null, ok)).toBeNull();
    expect(ratedScore(5.8, 90, { ...ok, ratingEnabled: false })).toBeNull();
    expect(ratedScore(5.8, 90, { ...ok, pattern: null })).toBeNull();
    expect(ratedScore(5.8, 90, { ...ok, pattern: "레이팅 제외" })).toBeNull();
    expect(ratedScore(null, 90, ok)).toBeNull();
  });
});
