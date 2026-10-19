import { describe, expect, it } from "vitest";
import { chartTier, chartTierAttrs, playerTierKey, chartTierStart, PLAYER_TIER_MINS, previewScore, ratedScore } from "@/lib/chart-tier";

describe("chartTierStart", () => {
  it("티어 최소 점수를 40으로 나눈다 (Iridescent 9500 -> 237.5, Alien 10000 -> 250, HSB 11000 -> 275)", () => {
    expect(chartTierStart(9500)).toBe(237.5);
    expect(chartTierStart(10000)).toBe(250);
    expect(chartTierStart(11000)).toBe(275);
    expect(chartTierStart(500)).toBe(12.5);
    expect(chartTierStart(0)).toBe(0);
  });

  it("티어는 22단계이고 최소 점수가 오름차순이다", () => {
    expect(PLAYER_TIER_MINS).toHaveLength(22);
    const mins = PLAYER_TIER_MINS.map((t) => t.min);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
  });
});

describe("chartTier", () => {
  it("경계: 시작점 바로 아래는 아래 티어, 시작점부터 위 티어", () => {
    expect(chartTier(12.49).key).toBe("WHITE");
    expect(chartTier(12.5).key).toBe("WHITE_GRADIENT");
    expect(chartTier(237.49).key).toBe("RAINBOW_GRADIENT");
    expect(chartTier(237.5).key).toBe("IRIDESCENT");
    expect(chartTier(249.99).key).toBe("IRIDESCENT");
    expect(chartTier(250).key).toBe("ALIEN");
    expect(chartTier(274.99).key).toBe("ALIEN");
    expect(chartTier(275).key).toBe("HSB");
    expect(chartTier(384).key).toBe("HSB"); // 7.0, 95%: 가장 높은 칸
  });

  it("0점과 음수는 가장 낮은 티어다", () => {
    expect(chartTier(0).key).toBe("WHITE");
    expect(chartTier(-5).key).toBe("WHITE");
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
  it("data-tier 하나만 붙인다 (예전 data-glow 빛 단계는 없다)", () => {
    expect(chartTierAttrs(80)).toEqual({ "data-tier": "GREEN" });
    expect(chartTierAttrs(384)).toEqual({ "data-tier": "HSB" });
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

describe("playerTierKey (레이팅 합계 → 티어, 정수부 기준)", () => {
  it("구간 경계는 아래쪽 값을 포함하고 소수는 버린다", () => {
    expect(playerTierKey(0)).toBe("WHITE");
    expect(playerTierKey(7999.99)).toBe("SILVER"); // 정수부 7999 < 8000
    expect(playerTierKey(8000)).toBe("GOLD");
    expect(playerTierKey(11000)).toBe("HSB");
    expect(playerTierKey(12345.6)).toBe("HSB");
  });

  it("레이팅 기록 화면의 예시 점수가 속한 티어", () => {
    expect(playerTierKey(8135.47)).toBe("GOLD");
    expect(playerTierKey(8026.5)).toBe("GOLD");
    expect(playerTierKey(7472.03)).toBe("BRONZE");
    expect(playerTierKey(3845.42)).toBe("GREEN_GRADIENT");
  });
});
