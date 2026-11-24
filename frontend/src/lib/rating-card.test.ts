import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { koT } from "@/i18n/ko-translator";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { PLAYER_TIER_MINS } from "@/lib/chart-tier";
import { TIER_CHIP_METAL, TIER_CHIPS } from "@/lib/tier-chip";
import {
  accentColor,
  buildCardModel,
  CARD_FRAME,
  STAGE_COLORS,
  cardDateLabel,
  cardFileName,
  fitTitle,
  TITLE_FONT_MAX,
  TITLE_FONT_MIN,
  LAYOUT_GEOMETRY,
  songScoreStyle,
  stageCounts,
  TIER_STYLES,
  tierStyleOf,
  truncateText,
} from "@/lib/rating-card";

function entry(rank: number, overrides: Partial<SkillEntryResponse> = {}): SkillEntryResponse {
  return {
    rank,
    songDifficultyId: rank,
    songId: rank,
    title: `Song ${rank}`,
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.45,
    tier: 9,
    pattern: "단일",
    achievementRate: 98.03,
    fullCombo: true,
    stage: "FC",
    ratingConstant: 30,
    value: 10,
    score: 200,
    ...overrides,
  };
}

/** globals.css에서 `[data-tier="KEY"] { … }` 규칙 줄들을 훑어 선언 하나(`--tier-fill` 등)의 값을 돌려준다. 없으면 빈 문자열. */
function cssDecl(css: string, key: string, name: string): string {
  for (const line of css.split("\n")) {
    if (!line.startsWith(`[data-tier="${key}"] {`)) continue;
    const match = new RegExp(`${name}:([^;]*);`).exec(line);
    if (match) return match[1].trim();
  }
  return "";
}

function skill(single: number, other: number): SkillResponse {
  return {
    noteOption: "SUPER_RANDOM_PLUS",
    totalScore: 5210.8,
    singleScore: 1980.2,
    otherScore: 3230.6,
    tier: { key: "PURPLE", displayName: "Purple", minScore: 5000, nextDisplayName: null, nextMinScore: null },
    singleLimit: 15,
    otherLimit: 25,
    single: Array.from({ length: single }, (_, i) => entry(i + 1)),
    other: Array.from({ length: other }, (_, i) => entry(i + 1, { pattern: "복합" })),
  };
}

const NOW = new Date("2026-10-22T15:30:00Z"); // 서울은 이미 10-23

describe("rating-card 색 표", () => {
  it("모든 티어가 표에 있다", () => {
    for (const tier of PLAYER_TIER_MINS) {
      expect(TIER_STYLES[tier.key]).toBeDefined();
    }
  });

  it("globals.css의 [data-tier] 색과 같다 (--tier-fill의 색 순서, --tier-glow의 유무)", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    for (const [key, style] of Object.entries(TIER_STYLES)) {
      const fill = cssDecl(css, key, "--tier-fill");
      expect(fill, key).not.toBe("");
      expect(fill.match(/#[0-9a-f]{6}/g) ?? [], key).toEqual([...style.stops]);
      expect(cssDecl(css, key, "--tier-glow") !== "", key).toBe(style.glow !== null);
    }
  });

  it("Rainbow는 끊어진 색 띠가 아니라 6색이 부드럽게 이어지는 그라데이션이다 (점수 글자·카드 테두리·막대, D96)", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    const palette = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#60a5fa", "#c084fc"];
    expect([...TIER_STYLES.RAINBOW.stops]).toEqual(palette);
    for (const decl of ["--tier-fill", "--tier-fill-light"]) {
      const value = cssDecl(css, "RAINBOW", decl);
      expect(value.startsWith("linear-gradient("), decl).toBe(true);
      const colors = value.match(/#[0-9a-f]{6}/g) ?? [];
      expect(colors.length, decl).toBe(6);
      expect(new Set(colors).size, `${decl}: 같은 색을 두 번 쓰면 띠가 된다`).toBe(6);
      // 색 뒤에 위치(%)를 따로 주면 끊어진 띠(hard stop)가 된다. 위치는 브라우저가 균등하게 나눠 보간한다
      expect(value, decl).not.toMatch(/#[0-9a-f]{6}\s+-?\d/);
    }
    // 점수 글자(.tier-score)·카드 테두리(.tier-card)·막대(.tier-bar)가 모두 --tier-fill을 읽는다
    expect(css).toMatch(/\.tier-bar \{ background: var\(--tier-fill\); \}/);
    expect(css).toMatch(/\.tier-score \{[^}]*background: var\(--tier-fill\)/);
    expect(css).toMatch(/var\(--card\)\) padding-box, var\(--tier-fill\) border-box/);
  });

  it("서열표 칸(.chart-cell/.chart-swatch/.chart-dot)은 --tier-fill이 아니라 --chart-fill을 쓰고, Bronze~Iridescent 6단계는 예전 색을 유지한다 (D96)", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    expect(css).toMatch(/\.chart-cell \{ background: var\(--chart-fill\)/);
    expect(css).toMatch(/\.chart-swatch \{ background: var\(--chart-fill\)/);
    expect(css).toMatch(/\.chart-dot \{ background: var\(--chart-fill\)/);
    const kept: Record<string, string[]> = {
      BRONZE: ["#b45309", "#f59e0b"],
      SILVER: ["#cbd5e1", "#f8fafc"],
      GOLD: ["#fcd34d", "#f59e0b"],
      RAINBOW: ["#fca5a5", "#fde68a", "#86efac", "#93c5fd", "#d8b4fe"],
      RAINBOW_GRADIENT: ["#ff6b6b", "#ffd93d", "#6bff95", "#6bd5ff", "#c084fc", "#ff6bd6"],
      IRIDESCENT: ["#ffe27a", "#ff7eb6", "#c084fc", "#22d3ee"],
    };
    for (const [key, colors] of Object.entries(kept)) {
      expect(cssDecl(css, key, "--chart-fill").match(/#[0-9a-f]{6}/g) ?? [], key).toEqual(colors);
    }
    // 나머지 티어는 기본 규칙(--chart-fill: var(--tier-fill))을 따라가므로 따로 값이 없다
    expect(css).toContain("[data-tier] { --chart-fill: var(--tier-fill); }");
    expect(cssDecl(css, "WHITE", "--chart-fill")).toBe("");
  });

  it("10,000 이상 4티어의 칩 테두리 색은 점수·카드 테두리(--tier-fill)와 같은 색이다(D95)", () => {
    for (const key of ["SIX_FINGERS", "MUTANT", "ALIEN", "HSB"]) {
      expect(TIER_CHIPS[key].border, key).toEqual([...TIER_STYLES[key].stops]);
      expect(TIER_CHIPS[key].fill, key).toEqual([...TIER_CHIP_METAL]);
    }
  });

  it("칩 디자인(lib/tier-chip.ts)은 globals.css가 아니라 이 표 한 곳이다: 옛 칩 규칙과 변수가 css에 남아 있지 않다(D95)", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    expect(css).not.toContain(".tier-chip");
    expect(css).not.toContain("--tier-metal");
    expect(css).not.toContain("--tier-text");
    // 카드·칩·막대에 box-shadow 빛이 없다(세로 띠는 D109 움직임만 있고 빛은 없다). --tier-glow는 서열표 칸과 점수 글자(D108, Gold 이상 drop-shadow)만 쓴다
    const users = css.split("\n").filter((l) => l.includes("var(--tier-glow)"));
    expect(users.every((l) => l.includes(".chart-cell") || l.includes(".chart-swatch") || l.includes("drop-shadow(var(--tier-glow))") || l.startsWith(" * ")), users.join("\n")).toBe(true);
  });

  it("Bronze 이상 10티어의 라이트 테마 글자·테두리 그라데이션은 흰 배경과 페이지 배경에서 모든 색이 대비 4.5:1 이상이다", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const key of ["BRONZE", "SILVER", "GOLD", "RAINBOW", "RAINBOW_GRADIENT", "IRIDESCENT", "SIX_FINGERS", "MUTANT", "ALIEN", "HSB"]) {
      const light = cssDecl(css, key, "--tier-fill-light");
      const colors = light.match(/#[0-9a-f]{6}/g) ?? [];
      expect(colors.length, key).toBeGreaterThanOrEqual(3);
      for (const color of colors) {
        expect(ratio(color, "#ffffff"), `${key} ${color} on card`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(color, "#f3f5f9"), `${key} ${color} on page`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("S+ 단계 색(빨강, D83)은 globals.css와 같고 다크·라이트 바탕에서 글자 대비 4.5:1 이상이다", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const texts = [...css.matchAll(/--stage-sp-text:\s*(#[0-9a-f]{6})/g)].map((m) => m[1]);
    expect(texts).toEqual(["#fca5a5", "#b91c1c", "#b91c1c"]); // 다크, 라이트, 라이트(시스템 설정)
    expect(STAGE_COLORS["S+"]).toBe(texts[0]);
    expect(ratio(texts[0], "#181d27")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(texts[1], "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("알 수 없는 티어는 White로 그린다", () => {
    expect(tierStyleOf("NOPE")).toBe(TIER_STYLES.WHITE);
  });

  it("곡 점수 색은 티어 최소 점수 ÷ 40 경계로 정해진다", () => {
    expect(songScoreStyle(0)).toBe(TIER_STYLES.WHITE);
    expect(songScoreStyle(124.9)).toBe(TIER_STYLES.BLUE_GRADIENT);
    expect(songScoreStyle(125)).toBe(TIER_STYLES.PURPLE);
    expect(songScoreStyle(250)).toBe(TIER_STYLES.SIX_FINGERS);
    expect(songScoreStyle(262.5)).toBe(TIER_STYLES.MUTANT);
    expect(songScoreStyle(275)).toBe(TIER_STYLES.ALIEN);
    expect(songScoreStyle(287.5)).toBe(TIER_STYLES.HSB);
  });
});

describe("truncateText", () => {
  const measure = (s: string) => Array.from(s).length * 10;
  it("들어가면 그대로", () => expect(truncateText("abc", 30, measure)).toBe("abc"));
  it("넘으면 …로 줄인다", () => {
    const out = truncateText("abcdefghij", 50, measure);
    expect(out).toBe("abcd…");
    expect(measure(out)).toBeLessThanOrEqual(50);
  });
  it("자리가 없으면 빈 글자", () => {
    expect(truncateText("abc", 0, measure)).toBe("");
    expect(truncateText("abcdef", 10, measure)).toBe("");
  });
  it("서러게이트 쌍을 자르지 않는다", () => {
    expect(truncateText("😀😀😀😀", 30, measure)).toBe("😀😀…");
  });
});

describe("fitTitle", () => {
  // 글자 하나가 size px 폭인 가짜 측정
  const measure = (size: number, text: string) => Array.from(text).length * size;

  it("들어가면 가장 큰 크기를 쓴다", () => {
    expect(fitTitle("abc", 100, measure)).toEqual({ size: TITLE_FONT_MAX, text: "abc" });
  });
  it("안 들어가면 들어가는 가장 큰 크기까지 줄인다", () => {
    // 5글자: 24px=120, 20px=100 -> 폭 100이면 20px
    expect(fitTitle("abcde", 100, measure)).toEqual({ size: 20, text: "abcde" });
  });
  it("최소 크기에서도 넘으면 최소 크기로 …를 붙여 줄인다", () => {
    const out = fitTitle("abcdefghij", 90, measure);
    expect(out.size).toBe(TITLE_FONT_MIN);
    expect(out.text.endsWith("…")).toBe(true);
    expect(measure(TITLE_FONT_MIN, out.text)).toBeLessThanOrEqual(90);
  });
});

describe("날짜·파일 이름", () => {
  it("Asia/Seoul 기준이다", () => {
    expect(cardDateLabel(NOW)).toBe("2026.10.23");
    expect(cardFileName(NOW)).toBe("srpfreaks-rating-20261023.png");
  });
});

describe("accentColor", () => {
  it("가장 밝은 색을 고른다", () => {
    expect(accentColor(TIER_STYLES.GOLD)).toBe("#fff1b0");
    expect(accentColor(TIER_STYLES.PURPLE)).toBe("#c084fc");
  });
});

describe("stageCounts", () => {
  it("EXC/FC/SS/S 곡 수를 센다", () => {
    const s = skill(2, 1);
    s.single[0].stage = "EXC";
    s.other[0].stage = "SS";
    const counts = Object.fromEntries(stageCounts(s).map((c) => [c.label, c.count]));
    expect(counts).toEqual({ EXC: 1, FC: 1, SS: 1, "S+": 0, S: 0 });
  });

  it("S+ 곡은 S와 따로 센다 (D83)", () => {
    const s = skill(2, 1);
    s.single[0].stage = "S+";
    s.single[1].stage = "S";
    const counts = Object.fromEntries(stageCounts(s).map((c) => [c.label, c.count]));
    expect(counts["S+"]).toBe(1);
    expect(counts.S).toBe(1);
    expect(stageCounts(s).map((c) => c.label)).toEqual(["EXC", "FC", "SS", "S+", "S"]);
  });
});

describe("buildCardModel", () => {
  it("가로: 5열 배치와 높이", () => {
    const m = buildCardModel("landscape", skill(15, 25), koT, { nickname: "Tester", now: NOW });
    const g = LAYOUT_GEOMETRY.landscape;
    expect(m.width).toBe(1920);
    expect(m.sections.map((s) => s.tiles.length)).toEqual([15, 25]);
    const first = m.sections[0].tiles;
    expect(first[0].x).toBe(m.contentX);
    expect(first[5].y - first[0].y).toBe(g.tileH + g.tileGap);
    expect(first[1].x).toBeGreaterThan(first[0].x + first[0].w);
    const last = m.sections[1].tiles[24];
    expect(m.height).toBe(last.y + last.h + CARD_FRAME + g.footH);
    // 타일이 안쪽 영역을 넘지 않는다
    for (const t of m.sections.flatMap((s) => s.tiles)) {
      expect(t.x + t.w).toBeLessThanOrEqual(m.contentX + m.contentW + 0.001);
    }
  });

  it("세로: 2열", () => {
    const m = buildCardModel("portrait", skill(15, 25), koT, { nickname: null, now: NOW });
    const tiles = m.sections[0].tiles;
    expect(m.width).toBe(1080);
    expect(tiles[1].y).toBe(tiles[0].y);
    expect(tiles[2].y).toBeGreaterThan(tiles[0].y);
    expect(m.header.nickname).toBeNull();
  });

  it("곡이 없는 구역은 건너뛰고 카드가 짧아진다", () => {
    const full = buildCardModel("landscape", skill(15, 25), koT, { nickname: "a", now: NOW });
    const small = buildCardModel("landscape", skill(3, 0), koT, { nickname: "a", now: NOW });
    expect(small.sections).toHaveLength(1);
    expect(small.sections[0].kind).toBe("single");
    expect(small.height).toBeLessThan(full.height);
  });

  it("속성은 단일 구역도 포함해 모든 타일에 들어간다(아랫줄 `Guitar · 속성`용, 2안)", () => {
    const s = skill(1, 1);
    s.single[0] = entry(1, { pattern: "단일" });
    s.other[0] = entry(2, { pattern: "복합" });
    const m = buildCardModel("portrait", s, koT, { nickname: "a", now: NOW });
    expect(m.sections[0].tiles[0].patternText).toBe("단일");
    expect(m.sections[1].tiles[0].patternText).toBe("복합");
  });

  it("fitTitle에 크기 범위를 고정하면 줄이지 않고 `…`로만 자른다", () => {
    const measure = (size: number, value: string) => value.length * size;
    expect(fitTitle("abcdefghij", 100, measure, { max: 20, min: 20 }).size).toBe(20);
    expect(fitTitle("abcdefghij", 100, measure, { max: 20, min: 20 }).text.endsWith("…")).toBe(true);
  });

  it("문구를 만든다", () => {
    const s = skill(1, 0);
    s.single[0] = entry(1, { achievementRate: 100, stage: "EXC", part: "BASS", pattern: null, score: 140 });
    const m = buildCardModel("landscape", s, koT, { nickname: "Tester", now: NOW });
    const t = m.sections[0].tiles[0];
    expect(t.rateText).toBe("MAX");
    expect(t.stageText).toBe("EXC");
    expect(t.scoreText).toBe("140.00");
    expect(t.scoreIntText).toBe("140");
    expect(t.scoreDecText).toBe(".00");
    expect(t.partText).toBe("Bass");
    expect(t.diffText).toBe("MAS 9.45");
    expect(t.patternText).toBe("");
    expect(t.tierText).toBe("9.0");
    expect(t.tier).toBe(TIER_STYLES.PURPLE_GRADIENT);
    expect(m.header.totalText).toBe("5210.80");
    expect(m.header.tierName).toBe("Purple");
    expect(m.footerRight).toBe("srpfreaks.com · 2026.10.23");
  });
});
