import { describe, expect, it } from "vitest";
import { PALETTE_COUNT, PATTERNS, tileInitial, tileSpec } from "@/lib/tile";

describe("tileSpec", () => {
  it("같은 곡 ID는 항상 같은 타일이다", () => {
    expect(tileSpec(42)).toEqual(tileSpec(42));
  });

  it("값이 범위 안에 있다", () => {
    for (let id = 1; id <= 500; id++) {
      const spec = tileSpec(id);
      expect(spec.palette).toBeGreaterThanOrEqual(0);
      expect(spec.palette).toBeLessThan(PALETTE_COUNT);
      expect(PATTERNS).toContain(spec.pattern);
      expect(spec.angle).toBeGreaterThanOrEqual(0);
      expect(spec.angle).toBeLessThan(360);
    }
  });

  it("곡이 많아도 색 쌍과 패턴이 골고루 쓰인다 (한 가지로 쏠리지 않는다)", () => {
    const palettes = new Set<number>();
    const patterns = new Set<string>();
    for (let id = 1; id <= 200; id++) {
      palettes.add(tileSpec(id).palette);
      patterns.add(tileSpec(id).pattern);
    }
    expect(palettes.size).toBe(PALETTE_COUNT);
    expect(patterns.size).toBe(PATTERNS.length);
  });
});

describe("tileInitial", () => {
  it("첫 글자를 대문자로 돌려준다", () => {
    expect(tileInitial("midnight")).toBe("M");
    expect(tileInitial("  悪魔のハニープリン")).toBe("悪");
  });

  it("이모지 같은 두 칸짜리 글자도 한 글자로 센다", () => {
    expect(tileInitial("🎸 Guitar")).toBe("🎸");
  });

  it("비어 있으면 빈 문자열이다", () => {
    expect(tileInitial("   ")).toBe("");
  });
});
