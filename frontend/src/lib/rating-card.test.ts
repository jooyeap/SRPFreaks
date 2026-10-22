import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { koT } from "@/i18n/ko-translator";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { PLAYER_TIER_MINS } from "@/lib/chart-tier";
import {
  accentColor,
  buildCardModel,
  CARD_FRAME,
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

  it("globals.css의 [data-tier] 색과 같다", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    for (const [key, style] of Object.entries(TIER_STYLES)) {
      const line = css.split("\n").find((l) => l.startsWith(`[data-tier="${key}"] {`));
      expect(line, key).toBeDefined();
      const colors = line!.match(/#[0-9a-f]{6}/g) ?? [];
      expect(colors, key).toEqual([...style.stops]);
      expect(line!.includes("--tier-glow"), key).toBe(style.glow !== null);
    }
  });

  it("알 수 없는 티어는 White로 그린다", () => {
    expect(tierStyleOf("NOPE")).toBe(TIER_STYLES.WHITE);
  });

  it("곡 점수 색은 티어 최소 점수 ÷ 40 경계로 정해진다", () => {
    expect(songScoreStyle(0)).toBe(TIER_STYLES.WHITE);
    expect(songScoreStyle(124.9)).toBe(TIER_STYLES.BLUE_GRADIENT);
    expect(songScoreStyle(125)).toBe(TIER_STYLES.PURPLE);
    expect(songScoreStyle(275)).toBe(TIER_STYLES.HSB);
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
    expect(accentColor(TIER_STYLES.GOLD)).toBe("#fcd34d");
    expect(accentColor(TIER_STYLES.PURPLE)).toBe("#c084fc");
  });
});

describe("stageCounts", () => {
  it("EXC/FC/SS/S 곡 수를 센다", () => {
    const s = skill(2, 1);
    s.single[0].stage = "EXC";
    s.other[0].stage = "SS";
    const counts = Object.fromEntries(stageCounts(s).map((c) => [c.label, c.count]));
    expect(counts).toEqual({ EXC: 1, FC: 1, SS: 1, S: 0 });
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

  it("문구를 만든다", () => {
    const s = skill(1, 0);
    s.single[0] = entry(1, { achievementRate: 100, stage: "EXC", part: "BASS", pattern: null, score: 140 });
    const m = buildCardModel("landscape", s, koT, { nickname: "Tester", now: NOW });
    const t = m.sections[0].tiles[0];
    expect(t.rateText).toBe("MAX · EXC");
    expect(t.partText).toBe("Bass");
    expect(t.diffText).toBe("MAS 9.45");
    expect(t.patternText).toBe("");
    expect(t.tierText).toBe("서열 9.0");
    expect(t.tierShortText).toBe("T9.0");
    expect(t.tier).toBe(TIER_STYLES.PURPLE_GRADIENT);
    expect(m.header.totalText).toBe("5210.80");
    expect(m.header.tierName).toBe("Purple");
    expect(m.footerRight).toBe("srpfreaks.com · 2026.10.23");
  });
});
