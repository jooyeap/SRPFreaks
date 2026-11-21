import { describe, expect, it } from "vitest";

import { PLAYER_TIER_MINS } from "@/lib/chart-tier";
import {
  TIER_CHIP_CHAR_EM,
  TIER_CHIP_MAX_CHARS,
  TIER_CHIP_SIDE_EM,
  TIER_CHIP_SIZES,
  TIER_CHIPS,
  tierChipDarkens, tierChipHighlight, tierChipLabel, tierChipOf,
  tierChipWidth,
} from "@/lib/tier-chip";

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

  describe("고정 폭: 24티어 모두(알약·육각) 같은 폭 (D102)", () => {
    const sizes = [
      ["작은 칩", TIER_CHIP_SIZES.sm.fs, 96],
      ["큰 칩", TIER_CHIP_SIZES.lg.fs, 123],
      ["레이팅 카드(Canvas) 칩", 22, 193],
    ] as const;

    for (const [label, fs, expected] of sizes) {
      it(`${label}(글자 ${fs}px): 폭은 이름·모양과 상관없이 ${expected}이다`, () => {
        // 직접 계산: 11자 × fs × 0.56 + fs × 2.6 = fs 11 -> 96.36, fs 14 -> 122.64, fs 22 -> 192.72 (반올림)
        expect(tierChipWidth(fs)).toBe(expected);
      });
    }

    it("글자 폭 추정치가 칩 폭 − 좌우 여백 안에 들어간다: 24티어 모두, 세 크기 모두", () => {
      expect(PLAYER_TIER_MINS).toHaveLength(24);
      for (const tier of PLAYER_TIER_MINS) {
        const chars = Array.from(tierChipLabel(tier.name)).length;
        // 새 티어 이름이 더 길어지면 여기서 실패한다: TIER_CHIP_MAX_CHARS를 늘려야 한다(폭이 한 곳에서만 정해지도록)
        expect(chars, `${tier.name}(${chars}자)이 TIER_CHIP_MAX_CHARS(${TIER_CHIP_MAX_CHARS})보다 길다`).toBeLessThanOrEqual(TIER_CHIP_MAX_CHARS);
        for (const fs of [TIER_CHIP_SIZES.sm.fs, TIER_CHIP_SIZES.lg.fs, 22]) {
          const textWidth = chars * fs * TIER_CHIP_CHAR_EM;
          // 반올림 오차 0.5. 여백(fs×2.6)은 육각 끝(노치)보다 넓다: 작은 칩 28.6 > 노치 7.1×2
          expect(textWidth, `${tier.name} @${fs}px`).toBeLessThanOrEqual(tierChipWidth(fs) - fs * TIER_CHIP_SIDE_EM + 0.5);
        }
      }
    });

    it("가장 긴 글자는 Rainbow Gr.(11자)이고, 그보다 긴 이름은 폭 안에 들어가지 않는다", () => {
      const longest = Math.max(...PLAYER_TIER_MINS.map((t) => Array.from(tierChipLabel(t.name)).length));
      expect(longest).toBe(TIER_CHIP_MAX_CHARS);
      expect(tierChipLabel("Rainbow Gradient")).toBe("Rainbow Gr.");
      const fs = TIER_CHIP_SIZES.sm.fs;
      expect(12 * fs * TIER_CHIP_CHAR_EM).toBeGreaterThan(tierChipWidth(fs) - fs * TIER_CHIP_SIDE_EM + 0.5);
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
