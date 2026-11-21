import { describe, expect, it } from "vitest";

import { PLAYER_TIER_MINS } from "@/lib/chart-tier";
import { TIER_CHIP_SIZES, TIER_CHIPS, tierChipDarkens, tierChipHighlight, tierChipLabel, tierChipOf, tierChipWidth } from "@/lib/tier-chip";

describe("tier-chip 표 (D95)", () => {
  it("24티어가 모두 표에 있다(PLAYER_TIER_MINS와 같은 key)", () => {
    expect(PLAYER_TIER_MINS).toHaveLength(24);
    for (const tier of PLAYER_TIER_MINS) {
      expect(TIER_CHIPS[tier.key], tier.key).toBeDefined();
    }
    expect(Object.keys(TIER_CHIPS).sort()).toEqual(PLAYER_TIER_MINS.map((t) => t.key).sort());
  });

  it("육각은 Alien·HSB뿐이고 나머지 22티어는 알약이다", () => {
    const hex = Object.entries(TIER_CHIPS).filter(([, c]) => c.shape === "hex").map(([k]) => k);
    expect(hex.sort()).toEqual(["ALIEN", "HSB"]);
  });

  it("색은 모두 6자리 hex이고, 같은 색을 두 번씩 쓴 Rainbow만 색 띠다", () => {
    for (const [key, chip] of Object.entries(TIER_CHIPS)) {
      for (const color of [...chip.fill, ...(chip.border ?? []), chip.text]) {
        expect(color, key).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(chip.fill.length, key).toBeGreaterThanOrEqual(2); // 단색 티어도 같은 색 두 개로 그라데이션이 만들어진다
    }
    expect(TIER_CHIPS.RAINBOW.fill).toHaveLength(12);
    expect(TIER_CHIPS.RAINBOW.border).toHaveLength(5);
    // Rainbow 3종은 서로 다른 면이다
    expect(new Set([TIER_CHIPS.RAINBOW.fill.join(), TIER_CHIPS.RAINBOW_GRADIENT.fill.join(), TIER_CHIPS.IRIDESCENT.fill.join()]).size).toBe(3);
  });

  it("하위 14티어는 테두리가 없고, Bronze 이상 10티어는 그라데이션 테두리가 있다", () => {
    const keys = PLAYER_TIER_MINS.map((t) => t.key);
    keys.slice(0, 14).forEach((k) => expect(TIER_CHIPS[k].border, k).toBeNull());
    keys.slice(14).forEach((k) => expect(TIER_CHIPS[k].border, k).not.toBeNull());
  });

  it("어두운 덧칠은 면이 가로인 칩(하위 14 + Rainbow 3종)에만, 하이라이트는 금속·검정 면 .4 그 외 .55", () => {
    expect(tierChipDarkens(TIER_CHIPS.ORANGE)).toBe(true);
    expect(tierChipDarkens(TIER_CHIPS.RAINBOW)).toBe(true);
    expect(tierChipDarkens(TIER_CHIPS.GOLD)).toBe(false);
    expect(tierChipDarkens(TIER_CHIPS.HSB)).toBe(false);
    expect(tierChipHighlight(TIER_CHIPS.ORANGE)).toBe(0.55);
    expect(tierChipHighlight(TIER_CHIPS.IRIDESCENT)).toBe(0.55);
    expect(tierChipHighlight(TIER_CHIPS.SILVER)).toBe(0.4);
    expect(tierChipHighlight(TIER_CHIPS.MUTANT)).toBe(0.4);
  });

  it("알 수 없는 key는 가장 낮은 티어 칩으로 그린다", () => {
    expect(tierChipOf("NOPE")).toBe(TIER_CHIPS.WHITE);
  });

  describe("폭 규칙: 짧은 이름만 최소 폭으로 넓히고 긴 이름은 넓히지 않는다", () => {
    const { fs } = TIER_CHIP_SIZES.sm;
    it("짧은 이름(HSB 육각, Red 알약)은 최소 폭이다", () => {
      expect(tierChipWidth("HSB", "hex", fs)).toBe(Math.round(fs * 8.4)); // 92
      expect(tierChipWidth("Red", "pill", fs)).toBe(Math.round(fs * 7.4)); // 81
      expect(tierChipWidth("Gold", "pill", fs)).toBe(81);
    });
    it("긴 이름은 글자 폭 + 여백(알약 fs×2.2, 육각 fs×2.6)이다", () => {
      // Rainbow Gradient 16자: 16×11×0.56 + 24.2 = 122.76 -> 123
      // (D102) 칩 글자는 `Rainbow Gr.` 11자: 11×11×0.56 + 24.2 = 91.96 -> 92. 전체 이름을 넘겨도 줄임말로 잰다
      expect(tierChipWidth("Rainbow Gradient", "pill", fs)).toBe(92);
      expect(tierChipWidth("Rainbow Gr.", "pill", fs)).toBe(92);
      // Alien 5자 육각: 5×11×.56 + 28.6 = 59.4 -> 최소 92
      expect(tierChipWidth("Alien", "hex", fs)).toBe(92);
      expect(tierChipWidth("Yellow Gradient", "pill", fs)).toBe(Math.max(Math.round(10 * fs * 0.56 + fs * 2.2), Math.round(fs * 7.4)));
    });
    it("최소 폭보다 큰 이름은 최소 폭 규칙의 영향을 받지 않는다(이름이 길수록 넓다)", () => {
      expect(tierChipWidth("Rainbow Gradient", "pill", fs)).toBeGreaterThan(tierChipWidth("Rainbow", "pill", fs)); // 92 > 81
      expect(tierChipWidth("Rainbow", "pill", fs)).toBeGreaterThanOrEqual(Math.round(fs * 7.4));
    });
    it("큰 배지(글자 14px)도 같은 비율이다", () => {
      const big = TIER_CHIP_SIZES.lg.fs;
      expect(tierChipWidth("6 Fingers", "pill", big)).toBe(Math.max(Math.round(9 * big * 0.56 + big * 2.2), Math.round(big * 7.4)));
      expect(tierChipWidth("Alien", "hex", big)).toBe(Math.round(big * 8.4)); // 118
    });
  });

  describe("tierChipLabel: Gradient -> Gr. (D102)", () => {
    const GRADIENT_TIERS = ["White", "Orange", "Yellow", "Green", "Blue", "Purple", "Red", "Rainbow"];
    it("Gradient가 들어간 티어는 모두 Gr.로 줄인다", () => {
      for (const color of GRADIENT_TIERS) {
        expect(tierChipLabel(`${color} Gradient`)).toBe(`${color} Gr.`);
      }
    });
    it("Gradient가 아닌 티어와 알 수 없는 이름은 그대로다", () => {
      for (const name of ["White", "Red", "Rainbow", "Bronze", "Iridescent", "6 Fingers", "Mutant", "Alien", "HSB", "Future"]) {
        expect(tierChipLabel(name)).toBe(name);
      }
      expect(tierChipLabel("Name RAINBOW_GRADIENT")).toBe("Name RAINBOW_GRADIENT"); // 단어 Gradient만 바꾼다
    });
    it("이미 줄인 글자에 다시 적용해도 같다(여러 번 거쳐도 안전)", () => {
      expect(tierChipLabel(tierChipLabel("Rainbow Gradient"))).toBe("Rainbow Gr.");
    });
  });
});
