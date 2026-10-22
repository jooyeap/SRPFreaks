import type { Translator } from "@/i18n/translator";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { chartTier } from "@/lib/chart-tier";
import { difficultyLabel, formatLevel, formatRate, formatScore, partLabel } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import type { AchievementStage, DifficultyType } from "@/lib/types";

/**
 * 레이팅 카드 이미지(D44)의 "무엇을 어디에 그릴지"를 정하는 순수 계산. 캔버스는 여기서 만든 모델을 그대로 그리기만 한다
 * (lib/rating-card-draw.ts). 계산을 그림 그리기에서 떼어 둔 이유: jsdom(테스트 환경)에는 캔버스가 없어서,
 * 위치·문구·색은 이 파일에서 테스트하고 캔버스 쪽은 가짜 컨텍스트로 호출만 확인한다.
 *
 * 카드는 사이트 테마와 상관없이 다크 고정이다(공유 이미지가 보는 사람의 설정에 따라 달라지지 않게). 그래서 색은
 * 다크 테마 값을 여기 상수로 둔다. 티어 색은 globals.css의 `[data-tier]`와 같은 값이어야 하고, 테스트가 두 파일을 비교한다.
 */

export const CARD_LAYOUTS = ["landscape", "portrait"] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];

/** 티어 하나의 색. stops가 1개면 단색, 여러 개면 왼쪽→오른쪽(칩·글자) 또는 위→아래(왼쪽 띠) 그라데이션이다. */
export interface CardTierStyle {
  stops: readonly string[];
  /** Bronze 이상의 빛. 낮은 티어는 없다 */
  glow: { color: string; blur: number } | null;
}

/** globals.css의 `[data-tier="…"]` 값과 같다(--tier-fill의 색 순서, --tier-glow의 크기와 색). rating-card.test.ts가 일치를 확인한다. */
export const TIER_STYLES: Record<string, CardTierStyle> = {
  WHITE: { stops: ["#e5e7eb"], glow: null },
  WHITE_GRADIENT: { stops: ["#e5e7eb", "#9ca3af"], glow: null },
  ORANGE: { stops: ["#fb923c"], glow: null },
  ORANGE_GRADIENT: { stops: ["#fb923c", "#fde68a"], glow: null },
  YELLOW: { stops: ["#facc15"], glow: null },
  YELLOW_GRADIENT: { stops: ["#facc15", "#bef264"], glow: null },
  GREEN: { stops: ["#4ade80"], glow: null },
  GREEN_GRADIENT: { stops: ["#4ade80", "#67e8f9"], glow: null },
  BLUE: { stops: ["#60a5fa"], glow: null },
  BLUE_GRADIENT: { stops: ["#60a5fa", "#c4b5fd"], glow: null },
  PURPLE: { stops: ["#c084fc"], glow: null },
  PURPLE_GRADIENT: { stops: ["#c084fc", "#f9a8d4"], glow: null },
  RED: { stops: ["#f87171"], glow: null },
  RED_GRADIENT: { stops: ["#f87171", "#fdba74"], glow: null },
  BRONZE: { stops: ["#b45309", "#f59e0b"], glow: { color: "rgb(245 158 11 / 0.35)", blur: 10 } },
  SILVER: { stops: ["#cbd5e1", "#f8fafc"], glow: { color: "rgb(203 213 225 / 0.45)", blur: 12 } },
  GOLD: { stops: ["#fcd34d", "#f59e0b"], glow: { color: "rgb(252 211 77 / 0.55)", blur: 14 } },
  RAINBOW: { stops: ["#fca5a5", "#fde68a", "#86efac", "#93c5fd", "#d8b4fe"], glow: { color: "rgb(147 197 253 / 0.55)", blur: 16 } },
  RAINBOW_GRADIENT: {
    stops: ["#ff6b6b", "#ffd93d", "#6bff95", "#6bd5ff", "#c084fc", "#ff6bd6"],
    glow: { color: "rgb(192 132 252 / 0.65)", blur: 20 },
  },
  IRIDESCENT: { stops: ["#ffe27a", "#ff7eb6", "#c084fc", "#22d3ee"], glow: { color: "rgb(255 126 182 / 0.7)", blur: 22 } },
  ALIEN: { stops: ["#b9f6ca", "#22d3ee", "#bae6fd"], glow: { color: "rgb(34 211 238 / 0.8)", blur: 24 } },
  HSB: { stops: ["#ffffff", "#fde68a", "#ffffff", "#bae6fd", "#ffffff"], glow: { color: "rgb(255 255 255 / 0.95)", blur: 28 } },
};

/** 알 수 없는 티어 key가 오면(서버가 티어를 늘렸을 때) 가장 낮은 티어 색으로 그린다. 카드가 깨지는 것보다 낫다. */
export function tierStyleOf(key: string): CardTierStyle {
  return TIER_STYLES[key] ?? TIER_STYLES.WHITE;
}

/** 곡 하나의 점수가 속한 티어 색 (lib/chart-tier.ts의 "곡 점수 ≥ 티어 최소 점수 ÷ 40" 규칙). */
export function songScoreStyle(score: number): CardTierStyle {
  return tierStyleOf(chartTier(score).key);
}

/** 달성 단계 글자색(다크 테마의 `--stage-*-text`). */
export const STAGE_COLORS: Record<AchievementStage, string> = {
  EXC: "#ffd84d",
  FC: "#67e8f9",
  SS: "#b3c9ff",
  S: "#86efac",
  A: "#c5cbda",
  B: "#a0a9bc",
  C: "#a0a9bc",
};

/** 난이도 색(다크 테마의 `--diff-*`). 파트·난이도 알약의 색이다. */
export const DIFFICULTY_COLORS: Record<DifficultyType, string> = {
  BASIC: "#6fd08c",
  ADVANCED: "#f2c94c",
  EXTREME: "#ff8f8f",
  MASTER: "#c4a3ff",
};

/** 카드 바깥 테두리 두께(티어 색 그라데이션) */
export const CARD_FRAME = 12;

interface LayoutGeometry {
  width: number;
  cols: number;
  padX: number;
  padTop: number;
  /** 머리글(이름·티어·점수) 높이 */
  headerH: number;
  tileH: number;
  tileGap: number;
  sectionGap: number;
  /** 구역 제목 줄 높이와 제목~카드 사이 간격 */
  titleH: number;
  titleGap: number;
  /** 맨 아래 문구가 차지하는 높이 */
  footH: number;
}

/**
 * 가로(1920px, 5열)와 세로(1080px, 2열). 높이는 곡 수에 따라 정해진다(40곡이 다 차면 가로 약 1085, 세로 약 2400).
 * 숫자는 시안(Tile-Grid-4 / Portrait-Tile)에서 눈으로 맞춘 값이다.
 */
export const LAYOUT_GEOMETRY: Record<CardLayout, LayoutGeometry> = {
  landscape: { width: 1920, cols: 5, padX: 52, padTop: 36, headerH: 104, tileH: 84, tileGap: 10, sectionGap: 22, titleH: 34, titleGap: 10, footH: 60 },
  portrait: { width: 1080, cols: 2, padX: 52, padTop: 40, headerH: 188, tileH: 84, tileGap: 10, sectionGap: 22, titleH: 34, titleGap: 10, footH: 60 },
};

export interface CardTileView {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  /** 속성(단일/복합/이중/삼중). 속성이 없으면 빈 글자 */
  patternText: string;
  partText: string;
  /** `MAS 9.45` */
  diffText: string;
  diffColor: string;
  /** `MAX · EXC`, `98.03 · FC` */
  rateText: string;
  stageColor: string;
  scoreText: string;
  /** 곡 점수 색(점수 글자와 왼쪽 띠) */
  tier: CardTierStyle;
}

export interface CardSectionView {
  kind: "single" | "other";
  title: string;
  sumText: string;
  /** 구역 제목 줄의 위쪽 y */
  y: number;
  tiles: CardTileView[];
}

export interface CardCountView {
  label: string;
  count: number;
  color: string;
}

export interface CardModel {
  layout: CardLayout;
  width: number;
  height: number;
  geometry: LayoutGeometry;
  contentX: number;
  contentW: number;
  /** 머리글의 위쪽 y */
  headerY: number;
  header: {
    brand: string;
    /** 닉네임을 끄거나 없으면 null */
    nickname: string | null;
    tierName: string;
    tier: CardTierStyle;
    totalText: string;
    counts: CardCountView[];
  };
  sections: CardSectionView[];
  footerLeft: string;
  footerRight: string;
}

/** 단계별 곡 수 (머리글 오른쪽에 EXC / FC / SS / S로 보인다). 레이팅 목록 40곡 전체가 대상이다. */
export function stageCounts(skill: SkillResponse): CardCountView[] {
  const entries = [...skill.single, ...skill.other];
  return (["EXC", "FC", "SS", "S"] as const).map((stage) => ({
    label: stage,
    count: entries.filter((entry) => entry.stage === stage).length,
    color: STAGE_COLORS[stage],
  }));
}

const seoulDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

/** Asia/Seoul 기준 날짜 `2026.10.22` (카드 오른쪽 아래). 화면의 다른 날짜와 같은 기준이다. */
export function cardDateLabel(now: Date): string {
  return seoulDate.format(now).replaceAll("-", ".");
}

/** 저장 파일 이름: `srpfreaks-rating-20261022.png` */
export function cardFileName(now: Date): string {
  return `srpfreaks-rating-${seoulDate.format(now).replaceAll("-", "")}.png`;
}

/**
 * 글자가 maxWidth를 넘으면 뒤를 `…`로 줄인다. measure는 캔버스의 measureText(글꼴이 정해진 뒤의 폭)를 넘긴다.
 * 글자 단위(이모지·서러게이트 쌍 포함)로 자르고, 이분 탐색이라 긴 곡명도 몇 번 만에 끝난다.
 */
export function truncateText(text: string, maxWidth: number, measure: (text: string) => number): string {
  if (maxWidth <= 0) {
    return "";
  }
  if (measure(text) <= maxWidth) {
    return text;
  }
  const chars = Array.from(text);
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(`${chars.slice(0, mid).join("")}…`) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low === 0 ? "" : `${chars.slice(0, low).join("").trimEnd()}…`;
}

/** 구역 합계 글자색: 티어 색 중 가장 밝은 것(어두운 배경에서 읽히게). */
export function accentColor(tier: CardTierStyle): string {
  const luminance = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };
  return [...tier.stops].sort((a, b) => luminance(b) - luminance(a))[0];
}

function tileView(entry: SkillEntryResponse, box: { x: number; y: number; w: number; h: number }, t: Translator): CardTileView {
  return {
    ...box,
    title: entry.title,
    patternText: entry.pattern ? patternLabel(entry.pattern, t) : "",
    partText: partLabel(entry.part),
    diffText: `${difficultyLabel(entry.difficulty)} ${formatLevel(entry.level)}`,
    diffColor: DIFFICULTY_COLORS[entry.difficulty],
    rateText: `${formatRate(entry.achievementRate)} · ${entry.stage}`,
    stageColor: STAGE_COLORS[entry.stage],
    scoreText: formatScore(entry.score),
    tier: songScoreStyle(entry.score),
  };
}

export interface CardOptions {
  /** 카드에 보일 닉네임. null이면 이름 줄을 그리지 않는다 */
  nickname: string | null;
  now: Date;
}

/**
 * 레이팅 목록(SkillResponse) -> 그릴 모델. 단일 → 그 외 순서로 구역을 쌓고, 곡이 없는 구역은 건너뛴다.
 * 높이는 마지막 줄 끝 + 바깥 테두리 + 아래 문구 자리다(곡이 적은 신규 사용자는 카드가 짧아진다).
 */
export function buildCardModel(layout: CardLayout, skill: SkillResponse, t: Translator, options: CardOptions): CardModel {
  const g = LAYOUT_GEOMETRY[layout];
  const contentX = CARD_FRAME + g.padX;
  const contentW = g.width - 2 * contentX;
  const tileW = (contentW - (g.cols - 1) * g.tileGap) / g.cols;
  const headerY = CARD_FRAME + g.padTop;

  let y = headerY + g.headerH;
  const sections: CardSectionView[] = [];
  const groups = [
    { kind: "single" as const, entries: skill.single, title: "RatingCard.sectionSingle" as const, sum: skill.singleScore },
    { kind: "other" as const, entries: skill.other, title: "RatingCard.sectionOther" as const, sum: skill.otherScore },
  ];
  for (const group of groups) {
    if (group.entries.length === 0) {
      continue;
    }
    y += g.sectionGap;
    const sectionY = y;
    y += g.titleH + g.titleGap;
    const tiles = group.entries.map((entry, index) =>
      tileView(
        entry,
        {
          x: contentX + (index % g.cols) * (tileW + g.tileGap),
          y: y + Math.floor(index / g.cols) * (g.tileH + g.tileGap),
          w: tileW,
          h: g.tileH,
        },
        t,
      ),
    );
    const rows = Math.ceil(group.entries.length / g.cols);
    y += rows * g.tileH + (rows - 1) * g.tileGap;
    sections.push({ kind: group.kind, title: t(group.title, { n: group.entries.length }), sumText: formatScore(group.sum), y: sectionY, tiles });
  }

  return {
    layout,
    width: g.width,
    height: y + CARD_FRAME + g.footH,
    geometry: g,
    contentX,
    contentW,
    headerY,
    header: {
      brand: `SRPFreaks · ${t("RatingCard.title")}`,
      nickname: options.nickname,
      tierName: skill.tier.displayName,
      tier: tierStyleOf(skill.tier.key),
      totalText: formatScore(skill.totalScore),
      counts: stageCounts(skill),
    },
    sections,
    footerLeft: t("RatingCard.footer"),
    footerRight: `${new URL(siteUrl()).host} · ${cardDateLabel(options.now)}`,
  };
}
