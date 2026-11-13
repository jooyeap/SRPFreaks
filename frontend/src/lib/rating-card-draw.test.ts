import { describe, expect, it, vi } from "vitest";

import { koT } from "@/i18n/ko-translator";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { jaT } from "@/i18n/ja-translator";
import type { Translator } from "@/i18n/translator";
import { buildCardModel, PART_TEXT_COLORS } from "@/lib/rating-card";
import { CARD_PANEL, drawRatingCard } from "@/lib/rating-card-draw";

function entry(rank: number): SkillEntryResponse {
  return {
    rank, songDifficultyId: rank, songId: rank, title: `Song ${rank}`, part: "GUITAR", difficulty: "MASTER", level: 9.45,
    tier: 9, pattern: "단일", achievementRate: 98.03, fullCombo: true, stage: "FC", ratingConstant: 30, value: 10, score: 200,
  };
}

/** jsdom에는 캔버스가 없어서, 어떤 호출이든 받는 가짜 컨텍스트로 "예외 없이 끝까지 그리고 글자를 그렸는지"만 본다. */
function fakeCtx() {
  const calls: Record<string, unknown[][]> = {};
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop === "measureText") return (s: string) => ({ width: s.length * 10 });
      if (prop === "createLinearGradient") return () => ({ addColorStop: vi.fn() });
      if (prop in t) return t[prop];
      return (...args: unknown[]) => {
        (calls[prop] ??= []).push(args);
      };
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("drawRatingCard", () => {
  const skill: SkillResponse = {
    noteOption: "SUPER_RANDOM_PLUS", totalScore: 5210.8, singleScore: 1980.2, otherScore: 3230.6,
    tier: { key: "PURPLE", displayName: "Purple", minScore: 5000, nextDisplayName: null, nextMinScore: null },
    singleLimit: 15, otherLimit: 25, single: [entry(1), entry(2)], other: [entry(1)],
  };

  for (const layout of ["landscape", "portrait"] as const) {
    it(`${layout}: 곡명·합계·문구를 그린다`, () => {
      const model = buildCardModel(layout, skill, koT, { nickname: "Tester", now: new Date("2026-10-22T00:00:00Z") });
      const { ctx, calls } = fakeCtx();
      drawRatingCard(ctx, model, { sans: "sans", num: "num" });
      const drawn = (calls.fillText ?? []).map((a) => a[0]);
      expect(drawn).toEqual(expect.arrayContaining(["Song 1", "Song 2", "5210.80", "Purple", "Tester", model.footerLeft]));
      // 점수는 정수부와 소수부로 나눠 그린다(2안)
      expect(drawn).toEqual(expect.arrayContaining(["200", ".00"]));
    });
  }

  it("닉네임이 없으면 이름을 그리지 않는다", () => {
    const model = buildCardModel("landscape", skill, koT, { nickname: null, now: new Date() });
    const { ctx, calls } = fakeCtx();
    drawRatingCard(ctx, model, { sans: "sans", num: "num" });
    expect((calls.fillText ?? []).map((a) => a[0])).not.toContain("Tester");
  });

  it("가로 5열은 재킷 56px, 점수가 알약과 겹치면 글자를 줄인다(22px까지)", () => {
    const model = buildCardModel("landscape", skill, koT, { nickname: null, now: new Date(), jacketUrlOf: () => "/jackets/1.webp" });
    const img = {} as HTMLImageElement;
    // 글자 폭을 글자 크기에 비례하게 재는 가짜 컨텍스트(크기를 줄이면 폭도 줄어든다)
    const calls: { font: string; text: string }[] = [];
    const drawn: number[][] = [];
    const state: Record<string, unknown> = {};
    const size = () => Number(/(\d+)px/.exec(String(state.font ?? "10px"))?.[1] ?? 10);
    const ctx = new Proxy(state, {
      get(t, prop: string) {
        if (prop === "measureText") return (s: string) => ({ width: s.length * size() * 0.6 });
        if (prop === "createLinearGradient") return () => ({ addColorStop: vi.fn() });
        if (prop === "fillText") return (s: string) => calls.push({ font: String(t.font), text: s });
        if (prop === "drawImage") return (...a: number[]) => drawn.push(a.slice(3));
        if (prop in t) return t[prop];
        return () => {};
      },
      set(t, prop: string, value) {
        t[prop] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    drawRatingCard(ctx, model, { sans: "sans", num: "num" }, new Map([["/jackets/1.webp", img]]));
    expect(drawn[0]).toEqual([56, 56]);
    const score = calls.find((c) => c.text === "200");
    expect(score).toBeDefined();
    const px = Number(/(\d+)px/.exec(score?.font ?? "")?.[1]);
    expect(px).toBeLessThanOrEqual(30);
    expect(px).toBeGreaterThanOrEqual(22);
  });

  it("재킷을 켜면(D54) 재킷이 있는 곡은 이미지를, 없는 곡은 단색 칸을 띠 오른쪽에 그린다", () => {
    const urlOf = (songId: number) => (songId === 1 ? "/jackets/1.webp" : null);
    const model = buildCardModel("portrait", skill, koT, { nickname: null, now: new Date(), jacketUrlOf: urlOf });
    expect(model.sections[0].tiles[0]).toMatchObject({ jacket: true, jacketUrl: "/jackets/1.webp" });
    expect(model.sections[0].tiles[1]).toMatchObject({ jacket: true, jacketUrl: null });
    const img = {} as HTMLImageElement;
    const { ctx, calls } = fakeCtx();
    drawRatingCard(ctx, model, { sans: "sans", num: "num" }, new Map([["/jackets/1.webp", img]]));
    // 재킷이 있는 곡은 두 번(단일·그 외 구역) 나온다
    expect((calls.drawImage ?? []).filter((a) => a[0] === img)).toHaveLength(2);
    expect((calls.drawImage ?? [])[0]?.slice(3)).toEqual([64, 64]);
  });

  it("재킷 옵션을 넘기지 않으면 재킷 칸이 없다", () => {
    const model = buildCardModel("portrait", skill, koT, { nickname: null, now: new Date() });
    expect(model.sections[0].tiles[0]).toMatchObject({ jacket: false, jacketUrl: null });
    const { ctx, calls } = fakeCtx();
    drawRatingCard(ctx, model, { sans: "sans", num: "num" });
    expect(calls.drawImage ?? []).toHaveLength(0);
  });

});

// ── 2안 타일(2026-11-09) ──────────────────────────────────────────────────────────────

interface Drawn {
  text: string;
  x: number;
  y: number;
  size: number;
  fill: unknown;
  align: string;
}

/** 글자 폭을 크기에 비례해 재는(한글·일본어는 정사각에 가깝게) 가짜 컨텍스트로 그리고, 그린 글자 목록을 돌려준다. */
function drawAll(model: ReturnType<typeof buildCardModel>, images: Map<string, HTMLImageElement> = new Map()): Drawn[] {
  const out: Drawn[] = [];
  const state: Record<string, unknown> = {};
  const size = () => Number(/(\d+)px/.exec(String(state.font ?? "10px"))?.[1] ?? 10);
  const width = (s: string) => Array.from(s).reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? size() : size() * 0.6), 0);
  const ctx = new Proxy(state, {
    get(t, prop: string) {
      if (prop === "measureText") return (s: string) => ({ width: width(s) });
      if (prop === "createLinearGradient") return () => ({ addColorStop: vi.fn() });
      if (prop === "fillText") return (s: string, x: number, y: number) => out.push({ text: s, x, y, size: size(), fill: t.fillStyle, align: String(t.textAlign) });
      if (prop in t) return t[prop];
      return () => {};
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  drawRatingCard(ctx, model, { sans: "sans", num: "num" }, images);
  return out;
}

function textWidth(d: Drawn): number {
  return Array.from(d.text).reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? d.size : d.size * 0.6), 0);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("레이팅 카드 타일 2안", () => {
  const skill: SkillResponse = {
    noteOption: "SUPER_RANDOM_PLUS", totalScore: 5210.8, singleScore: 1980.2, otherScore: 3230.6,
    tier: { key: "PURPLE", displayName: "Purple", minScore: 5000, nextDisplayName: null, nextMinScore: null },
    singleLimit: 15, otherLimit: 25,
    single: [{ ...entry(1), title: "KAISER PHOENIX", pattern: "단일", score: 240 }],
    other: [
      { ...entry(2), title: "A very long song title that must be shortened with an ellipsis", pattern: "복합(단일)", part: "BASS", stage: "EXC", achievementRate: 100, score: 224 },
      { ...entry(3), pattern: "삼중", score: 240.4 },
    ],
  };
  const now = new Date("2026-11-09T00:00:00Z");

  const cases: Array<[string, Translator, "landscape" | "portrait", boolean]> = [
    ["ko 가로 재킷 켬", koT, "landscape", true],
    ["ko 가로 재킷 끔", koT, "landscape", false],
    ["ja 가로 재킷 켬", jaT, "landscape", true],
    ["ja 가로 재킷 끔", jaT, "landscape", false],
    ["ko 세로 재킷 켬", koT, "portrait", true],
    ["ja 세로 재킷 켬", jaT, "portrait", true],
  ];

  for (const [name, t, layout, jacket] of cases) {
    describe(name, () => {
      const model = buildCardModel(layout, skill, t, { nickname: null, now, ...(jacket ? { jacketUrlOf: () => null } : {}) });
      const drawn = drawAll(model);
      const tiles = model.sections.flatMap((section) => section.tiles);

      it("곡명 줄에는 속성이 없고, 아랫줄 `파트 · 속성`에만 있다 (단일 구역도 포함)", () => {
        for (const tile of tiles) {
          const title = drawn.find((d) => d.text === tile.title || (d.text.endsWith("…") && tile.title.startsWith(d.text.slice(0, -1))));
          expect(title, tile.title).toBeDefined();
          // 속성 글자가 곡명 줄(곡명과 같은 기준선)에 그려진 적이 없다
          expect(drawn.filter((d) => d.y === title?.y && d.text.includes(tile.patternText))).toHaveLength(0);
          const line = drawn.find((d) => d.text === ` · ${tile.patternText}` && d.y > (title?.y ?? 0) && d.x > tile.x && d.x < tile.x + tile.w);
          expect(line, tile.patternText).toBeDefined();
        }
        // 단일 구역(1) + 그 외 구역(2) 타일 모두에서 아랫줄이 그려진다
        expect(drawn.filter((d) => d.text.startsWith(" · "))).toHaveLength(3);
      });

      it("가장 긴 속성도 점수와 겹치지 않고 타일 안에 온전히 들어온다(글자를 줄이거나 자르지 않는다)", () => {
        for (const tile of tiles) {
          const inTile = (d: Drawn) => d.x > tile.x && d.x <= tile.x + tile.w && d.y >= tile.y && d.y <= tile.y + tile.h;
          const rest = drawn.find((d) => inTile(d) && d.text === ` · ${tile.patternText}`);
          const part = drawn.find((d) => inTile(d) && d.text === tile.partText);
          const dec = drawn.find((d) => inTile(d) && d.text === tile.scoreDecText);
          const int = drawn.find((d) => inTile(d) && d.text === tile.scoreIntText);
          expect(rest && part && dec && int).toBeTruthy();
          if (!rest || !part || !dec || !int) continue;
          expect(rest.size).toBe(12); // 글자를 줄이지 않는다
          expect(rest.text).toBe(` · ${tile.patternText}`); // 말줄임 없음
          const lineEnd = rest.x + textWidth(rest);
          const scoreLeft = int.x - textWidth(int) - textWidth(dec);
          expect(lineEnd + 10).toBeLessThanOrEqual(scoreLeft);
          expect(lineEnd).toBeLessThanOrEqual(tile.x + tile.w - 16);
        }
      });

      it("점수는 정수부 + 같은 기준선의 작은 소수부(약 60%)로 그린다", () => {
        for (const tile of tiles) {
          const inTile = (d: Drawn) => d.x > tile.x && d.x <= tile.x + tile.w && d.y >= tile.y && d.y <= tile.y + tile.h;
          const dec = drawn.find((d) => inTile(d) && d.text === tile.scoreDecText);
          const int = drawn.find((d) => inTile(d) && d.text === tile.scoreIntText);
          expect(dec?.y).toBe(int?.y);
          expect(dec?.size).toBe(Math.round((int?.size ?? 0) * 0.6));
        }
      });

      it("달성률 옆에 단계 글자 칩이 있고, 서열표 난이도 숫자가 라벨 없이 점수 위에 있다", () => {
        for (const tile of tiles) {
          const inTile = (d: Drawn) => d.x > tile.x && d.x <= tile.x + tile.w && d.y >= tile.y && d.y <= tile.y + tile.h;
          expect(drawn.some((d) => inTile(d) && d.text === tile.stageText)).toBe(true);
          expect(drawn.some((d) => inTile(d) && d.text === tile.rateText)).toBe(true);
          const tierNum = drawn.find((d) => inTile(d) && d.text === tile.tierText);
          const int = drawn.find((d) => inTile(d) && d.text === tile.scoreIntText);
          expect(tierNum && int && tierNum.y < int.y).toBe(true);
        }
      });

      it("긴 곡명은 `…`로 줄이고 글자 크기는 고정이다", () => {
        const long = drawn.find((d) => d.text.endsWith("…") && d.text.startsWith("A very"));
        expect(long).toBeDefined();
        expect(long?.size).toBe(layout === "landscape" ? 20 : 22);
      });
    });
  }

  it("파트 글자색(Guitar 보라 / Bass 청록)은 타일 바탕 위에서 글자 대비 4.5:1 이상이다", () => {
    expect(contrast(PART_TEXT_COLORS.GUITAR, CARD_PANEL)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(PART_TEXT_COLORS.BASS, CARD_PANEL)).toBeGreaterThanOrEqual(4.5);
  });

  it("Bass 타일은 청록, Guitar 타일은 보라 글자로 파트 이름을 쓴다(색만으로 전달하지 않는다)", () => {
    const model = buildCardModel("landscape", skill, koT, { nickname: null, now });
    const drawn = drawAll(model);
    expect(drawn.find((d) => d.text === "Bass")?.fill).toBe(PART_TEXT_COLORS.BASS);
    expect(drawn.find((d) => d.text === "Guitar")?.fill).toBe(PART_TEXT_COLORS.GUITAR);
  });
});
