import {
  accentColor,
  CARD_FRAME,
  type CardModel,
  type CardTierStyle,
  type CardTileView,
  fitTitle,
  truncateText,
} from "@/lib/rating-card";

/**
 * 레이팅 카드 모델(lib/rating-card.ts)을 캔버스에 그린다. 위치·문구·색은 모델이 이미 정했으므로 여기서는 "그리기"만 한다.
 * 카드는 사이트 테마와 상관없이 다크 고정이다.
 */

const BG = "#0f1218";
const PANEL = "#171c26";
const LINE = "#2a3142";
const TEXT = "#eef0f6";
const TEXT_SUB = "#c5cbda";
const TEXT_MUTED = "#a0a9bc";
const PART_BG = "#2a1a24";
const PART_GUITAR = "#f9a8d4";
const PART_BASS = "#5eead4";
const DIFF_TEXT = "#12151c";
const TIER_SEG_BG = "#262d3d";

export interface CardFonts {
  sans: string;
  num: string;
}

/** 사이트에서 쓰는 글꼴 이름(next/font가 붙인 이름)을 CSS 변수에서 읽는다. 못 읽으면 시스템 글꼴. */
export function readCardFonts(): CardFonts {
  const style = typeof document !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const sans = style?.getPropertyValue("--font-sans").trim();
  const num = style?.getPropertyValue("--font-num").trim();
  return { sans: sans || "system-ui, sans-serif", num: num || "system-ui, sans-serif" };
}

/**
 * 카드에 나오는 글자가 쓰는 글꼴 조각(subset)을 미리 받아 둔다. next/font는 글자가 화면에 처음 나올 때 조각을 받기 때문에,
 * 카드에만 있는 글자(곡명의 일본어 등)는 아직 안 받았을 수 있다. 실제 글자를 넘겨 `load`하면 필요한 조각만 받는다.
 * 실패해도 시스템 글꼴로 그려지므로 던지지 않는다.
 */
export async function loadCardFonts(model: CardModel, fonts: CardFonts): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) {
    return;
  }
  const texts = new Set<string>();
  texts.add(model.header.brand);
  texts.add(model.footerLeft);
  for (const section of model.sections) {
    texts.add(section.title);
    for (const tile of section.tiles) {
      texts.add(tile.title);
      texts.add(tile.patternText);
    }
  }
  const sample = Array.from(texts).join(" ");
  try {
    await Promise.all([
      document.fonts.load(`500 20px ${fonts.sans}`, sample),
      document.fonts.load(`700 20px ${fonts.sans}`, sample),
      document.fonts.load(`700 20px ${fonts.num}`, "0123456789.·MAXEFCSG"),
      document.fonts.load(`600 20px ${fonts.num}`, "0123456789.·MAXEFCSG"),
    ]);
  } catch {
    // 글꼴을 못 받아도 기본 글꼴로 그린다
  }
}

type Ctx = CanvasRenderingContext2D;

function gradient(ctx: Ctx, tier: CardTierStyle, x0: number, y0: number, x1: number, y1: number): string | CanvasGradient {
  if (tier.stops.length === 1) {
    return tier.stops[0];
  }
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  tier.stops.forEach((color, i) => grad.addColorStop(i / (tier.stops.length - 1), color));
  return grad;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function text(ctx: Ctx, value: string, x: number, y: number, font: string, fill: string | CanvasGradient, align: CanvasTextAlign = "left"): void {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y);
}

/** 빛(번짐)을 켠 채 그린다. 안 쓸 때는 반드시 꺼서 다른 그림에 번지지 않게 한다. */
function withGlow(ctx: Ctx, tier: CardTierStyle, draw: () => void): void {
  ctx.save();
  if (tier.glow) {
    ctx.shadowColor = tier.glow.color;
    ctx.shadowBlur = tier.glow.blur;
  }
  draw();
  ctx.restore();
}

function drawHeader(ctx: Ctx, m: CardModel, f: CardFonts): void {
  const { header: h, contentX: x0, contentW: w, headerY: y0 } = m;
  const right = x0 + w;
  const portrait = m.layout === "portrait";
  const tierFill = (x: number, y: number, ww: number) => gradient(ctx, h.tier, x, y, x + ww, y);

  text(ctx, "SRPFreaks", x0, y0 + 30, `700 30px ${f.num}`, TEXT);
  const brandW = ctx.measureText("SRPFreaks").width;
  text(ctx, h.brand.replace("SRPFreaks · ", ""), x0 + brandW + 16, y0 + 30, `500 22px ${f.sans}`, TEXT_MUTED);

  // 합계 점수(크게)
  // 가로는 옆의 닉네임(44px)과 같은 크기, 세로는 기존 크기 (2026-10-22 피드백: 가로 합계가 너무 큼)
  const totalSize = portrait ? 104 : 44;
  ctx.font = `700 ${totalSize}px ${f.num}`;
  const totalW = ctx.measureText(h.totalText).width;
  const totalBase = y0 + (portrait ? 148 : 76); // 가로는 닉네임과 같은 기준선
  withGlow(ctx, h.tier, () => text(ctx, h.totalText, right, totalBase, `700 ${totalSize}px ${f.num}`, tierFill(right - totalW, totalBase, totalW), "right"));

  // 닉네임 + 티어 칩
  const nameY = y0 + (portrait ? 96 : 76);
  let chipX = x0;
  if (h.nickname) {
    const name = truncateText(h.nickname, portrait ? w * 0.5 : 520, (s) => {
      ctx.font = `700 44px ${f.sans}`;
      return ctx.measureText(s).width;
    });
    text(ctx, name, x0, nameY, `700 44px ${f.sans}`, TEXT);
    chipX = x0 + ctx.measureText(name).width + 22;
  }
  const chipH = 40;
  ctx.font = `700 22px ${f.num}`;
  const chipW = ctx.measureText(h.tierName).width + 40;
  const chipY = nameY - 32;
  if (!h.nickname) {
    chipX = x0;
  }
  withGlow(ctx, h.tier, () => {
    roundRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fillStyle = gradient(ctx, h.tier, chipX, chipY, chipX + chipW, chipY);
    ctx.fill();
  });
  text(ctx, h.tierName, chipX + chipW / 2, chipY + 28, `700 22px ${f.num}`, BG, "center");

  // 단계별 곡 수 (가로: 합계 아래 오른쪽, 세로: 닉네임 줄 아래 왼쪽)
  let cx = portrait ? x0 : right;
  const countY = y0 + (portrait ? 176 : 100);
  const items = portrait ? h.counts : [...h.counts].reverse();
  for (const c of items) {
    const label = `${c.label} `;
    const num = String(c.count);
    ctx.font = `500 20px ${f.sans}`;
    const lw = ctx.measureText(label).width;
    ctx.font = `700 20px ${f.num}`;
    const nw = ctx.measureText(num).width;
    const itemW = lw + nw;
    if (portrait) {
      text(ctx, label, cx, countY, `500 20px ${f.sans}`, TEXT_SUB);
      text(ctx, num, cx + lw, countY, `700 20px ${f.num}`, c.color);
      cx += itemW + 22;
    } else {
      cx -= itemW;
      text(ctx, label, cx, countY + 24, `500 20px ${f.sans}`, TEXT_SUB);
      text(ctx, num, cx + lw, countY + 24, `700 20px ${f.num}`, c.color);
      cx -= 22;
    }
  }

  // 머리글 아래 구분선
  ctx.fillStyle = LINE;
  ctx.fillRect(x0, y0 + m.geometry.headerH - 4, w, 1);
}

function drawTile(ctx: Ctx, tile: CardTileView, f: CardFonts, compact: boolean): void {
  const { x, y, w, h } = tile;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = PANEL;
  ctx.fill();

  // 왼쪽 띠: 곡 레이팅 티어 색 (위→아래 그라데이션)
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  withGlow(ctx, tile.tier, () => {
    ctx.fillStyle = gradient(ctx, tile.tier, x, y, x, y + h);
    ctx.fillRect(x, y, 8, h);
  });
  ctx.restore();

  const left = x + 24;
  const right = x + w - 16;

  // 좁은 타일(가로 5열)은 점수를 조금 줄여 알약(세 칸)과 점수가 겹치지 않게 한다
  const scoreSize = compact ? 30 : 32;

  // 오른쪽 덩어리: 위에 `rate · stage`, 아래에 점수
  ctx.font = `700 ${scoreSize}px ${f.num}`;
  const scoreW = ctx.measureText(tile.scoreText).width;
  const scoreBase = y + h - 14;
  text(ctx, tile.scoreText, right, scoreBase, `700 ${scoreSize}px ${f.num}`, gradient(ctx, tile.tier, right - scoreW, scoreBase, right, scoreBase), "right");
  ctx.font = `600 17px ${f.num}`;
  const rateW = ctx.measureText(tile.rateText).width;
  text(ctx, tile.rateText, right, y + 28, `600 17px ${f.num}`, tile.stageColor, "right");


  // 속성 칩: 곡명 줄의 오른쪽(`rate · stage` 왼쪽). 아래 줄은 알약과 점수가 이미 차지해서 여기에 둔다.
  let chipW = 0;
  if (tile.patternText) {
    ctx.font = `700 12px ${f.sans}`;
    chipW = ctx.measureText(tile.patternText).width + 16;
    const chipX = right - rateW - 12 - chipW;
    roundRect(ctx, chipX, y + 13, chipW, 20, 10);
    ctx.strokeStyle = "#3a4258";
    ctx.lineWidth = 1;
    ctx.stroke();
    text(ctx, tile.patternText, chipX + chipW / 2, y + 28, `700 12px ${f.sans}`, TEXT_SUB, "center");
    chipW += 12;
  }
  const textMax = w - 24 - 16 - rateW - chipW - 12;

  // 곡명: 24px로 시작해 칸에 안 들어가면 18px까지 줄이고, 그래도 넘으면 `…`로 줄인다(짧은 곡명은 크게, 긴 곡명은 덜 잘리게)
  const fit = fitTitle(tile.title, textMax, (size, value) => {
    ctx.font = `500 ${size}px ${f.sans}`;
    return ctx.measureText(value).width;
  });
  text(ctx, fit.text, left, y + 33, `500 ${fit.size}px ${f.sans}`, TEXT);

  // 파트 | 난이도 | 서열 기준 난이도 (한 덩어리 알약. 세 번째 칸은 숫자만)
  const pillY = y + h - 34;
  const pillH = 22;
  ctx.font = `700 13px ${f.num}`;
  const partW = ctx.measureText(tile.partText).width + 14;
  const diffW = ctx.measureText(tile.diffText).width + 14;
  const tierW = ctx.measureText(tile.tierText).width + 14;
  ctx.save();
  roundRect(ctx, left, pillY, partW + diffW + tierW, pillH, 5);
  ctx.clip();
  ctx.fillStyle = PART_BG;
  ctx.fillRect(left, pillY, partW, pillH);
  ctx.fillStyle = tile.diffColor;
  ctx.fillRect(left + partW, pillY, diffW, pillH);
  ctx.fillStyle = TIER_SEG_BG;
  ctx.fillRect(left + partW + diffW, pillY, tierW, pillH);
  ctx.restore();
  text(ctx, tile.partText, left + 7, pillY + 16, `700 13px ${f.num}`, tile.partText === "Bass" ? PART_BASS : PART_GUITAR);
  text(ctx, tile.diffText, left + partW + 7, pillY + 16, `700 13px ${f.num}`, DIFF_TEXT);
  text(ctx, tile.tierText, left + partW + diffW + 7, pillY + 16, `700 13px ${f.num}`, TEXT);
}

/** 카드 전체를 그린다. 캔버스 크기는 호출하는 쪽이 model.width × model.height로 맞춰 둔다. */
export function drawRatingCard(ctx: Ctx, m: CardModel, fonts: CardFonts): void {
  const { width, height } = m;

  // 바깥 테두리: 티어 색 (Bronze 이상은 빛)
  ctx.fillStyle = gradient(ctx, m.header.tier, 0, 0, width, height);
  ctx.fillRect(0, 0, width, height);
  roundRect(ctx, CARD_FRAME, CARD_FRAME, width - 2 * CARD_FRAME, height - 2 * CARD_FRAME, 20);
  ctx.fillStyle = BG;
  ctx.fill();

  drawHeader(ctx, m, fonts);

  for (const section of m.sections) {
    const titleBase = section.y + 26;
    text(ctx, section.title, m.contentX, titleBase, `700 24px ${fonts.sans}`, TEXT);
    ctx.font = `700 24px ${fonts.sans}`;
    const tw = ctx.measureText(section.title).width;
    text(ctx, section.sumText, m.contentX + tw + 14, titleBase, `700 22px ${fonts.num}`, accentColor(m.header.tier));
    for (const tile of section.tiles) {
      drawTile(ctx, tile, fonts, m.layout === "landscape");
    }
  }

  const footY = height - CARD_FRAME - 22;
  text(ctx, m.footerLeft, m.contentX, footY, `500 17px ${fonts.sans}`, TEXT_MUTED);
  text(ctx, m.footerRight, m.contentX + m.contentW, footY, `500 17px ${fonts.num}`, TEXT_MUTED, "right");
}

/** 캔버스를 만들어 그린 뒤 돌려준다. 브라우저에서만 호출한다. */
export async function renderRatingCard(model: CardModel): Promise<HTMLCanvasElement> {
  const fonts = readCardFonts();
  await loadCardFonts(model, fonts);
  const canvas = document.createElement("canvas");
  canvas.width = model.width;
  canvas.height = model.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas 2d is not available");
  }
  drawRatingCard(ctx, model, fonts);
  return canvas;
}
