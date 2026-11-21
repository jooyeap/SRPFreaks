/**
 * 플레이어 티어 칩(뱃지) 디자인 (D95). 24티어 모두 같은 문법이다: 아래 그림자 → 면 → (어두운 덧칠) → 위쪽 흰 하이라이트 → 테두리 → 글자.
 *  - 하위 14티어(White ~ Red Gradient): 색 면 + 약한 광택, 테두리 없음.
 *  - Bronze ~ Iridescent: 금속 띠(Bronze·Silver·Gold) / 또렷한 색 띠(Rainbow) / 부드러운 그라데이션(Rainbow Gradient) / 진주빛(Iridescent).
 *  - 10,000 이상 4티어: 검정 금속 면 + 티어 색 네온 테두리 + 티어 색 글자.
 * 모양은 알약(pill)이고 Alien·HSB만 좌우가 뾰족한 육각 노치(hex)다. 옆 장식·글로우·반짝임은 없다.
 *
 * 사이트의 SVG 칩(components/rating/TierChip.tsx)과 레이팅 카드 이미지의 Canvas 칩(lib/rating-card-draw.ts)이 이 표 하나를 읽는다.
 * 그래서 둘의 색·폭이 달라질 수 없다. 점수 글자·카드 테두리·서열표 칸의 색(--tier-fill)은 globals.css가 따로 정한다.
 */

export type TierChipShape = "pill" | "hex";

export interface TierChipSpec {
  shape: TierChipShape;
  /** 칩 면의 그라데이션 색(균등 간격). 같은 색을 두 번씩 쓰면 색 띠가 된다(Rainbow) */
  fill: readonly string[];
  /** true면 면 그라데이션이 위→아래(금속), false면 왼쪽→오른쪽 */
  vertical: boolean;
  /** 그라데이션 테두리(왼쪽→오른쪽). 하위 14티어는 없다 */
  border: readonly string[] | null;
  /** 이름 글자색 */
  text: string;
}

/** 검정 금속 면(위→아래 4색) */
export const TIER_CHIP_METAL = ["#2b2438", "#0c0a14", "#1c1626", "#0c0a14"] as const;

const LOW_TEXT = "#10131a";
const RAINBOW_BORDER = ["#f87171", "#facc15", "#4ade80", "#60a5fa", "#c084fc"] as const;
const RAINBOW_GRADIENT = ["#ff6b6b", "#ffd93d", "#6bff95", "#6bd5ff", "#c084fc", "#ff6bd6"] as const;

function flat(...stops: string[]): TierChipSpec {
  return { shape: "pill", fill: stops.length > 1 ? stops : [stops[0], stops[0]], vertical: false, border: null, text: LOW_TEXT };
}

function neon(shape: TierChipShape, border: readonly string[], text: string): TierChipSpec {
  return { shape, fill: TIER_CHIP_METAL, vertical: true, border, text };
}

export const TIER_CHIPS: Record<string, TierChipSpec> = {
  WHITE: flat("#e5e7eb"),
  WHITE_GRADIENT: flat("#e5e7eb", "#9ca3af"),
  ORANGE: flat("#fb923c"),
  ORANGE_GRADIENT: flat("#fb923c", "#fde68a"),
  YELLOW: flat("#facc15"),
  YELLOW_GRADIENT: flat("#facc15", "#bef264"),
  GREEN: flat("#4ade80"),
  GREEN_GRADIENT: flat("#4ade80", "#67e8f9"),
  BLUE: flat("#60a5fa"),
  BLUE_GRADIENT: flat("#60a5fa", "#c4b5fd"),
  PURPLE: flat("#c084fc"),
  PURPLE_GRADIENT: flat("#c084fc", "#f9a8d4"),
  RED: flat("#f87171"),
  RED_GRADIENT: flat("#f87171", "#fdba74"),
  BRONZE: { shape: "pill", fill: ["#fcd9a8", "#e08a3c", "#8a4513", "#c8793a"], vertical: true, border: ["#fcd9a8", "#e08a3c", "#9a4a12"], text: "#2b1405" },
  SILVER: { shape: "pill", fill: ["#ffffff", "#d5dce6", "#8d99ab", "#e2e8f0"], vertical: true, border: ["#ffffff", "#cbd5e1", "#94a3b8"], text: "#1b2230" },
  GOLD: { shape: "pill", fill: ["#fff1b0", "#fcd34d", "#b7791f", "#f3c13a"], vertical: true, border: ["#fff1b0", "#fcd34d", "#d97706"], text: "#3a2605" },
  // Rainbow: 5색을 두 번씩 써서 또렷한 색 띠. 가운데 Rainbow Gradient(부드러운 그라데이션)·Iridescent(진주빛)와 한눈에 구분된다
  RAINBOW: {
    shape: "pill",
    fill: ["#f87171", "#f87171", "#fb923c", "#fb923c", "#facc15", "#facc15", "#4ade80", "#4ade80", "#60a5fa", "#60a5fa", "#c084fc", "#c084fc"],
    vertical: false,
    border: RAINBOW_BORDER,
    text: LOW_TEXT,
  },
  RAINBOW_GRADIENT: { shape: "pill", fill: RAINBOW_GRADIENT, vertical: false, border: RAINBOW_GRADIENT, text: LOW_TEXT },
  IRIDESCENT: {
    shape: "pill",
    fill: ["#fff7ed", "#fbcfe8", "#bae6fd", "#d9f99d", "#fde68a", "#fbcfe8"],
    vertical: false,
    border: ["#ffe27a", "#ff7eb6", "#c084fc", "#22d3ee"],
    text: "#2a1a3a",
  },
  SIX_FINGERS: neon("pill", ["#f0abfc", "#a78bfa", "#f472b6"], "#f5d0fe"),
  MUTANT: neon("pill", ["#ff7ae6", "#ff2bd6", "#a855f7"], "#ffd0f5"),
  ALIEN: neon("hex", ["#a5f3fc", "#22d3ee", "#a7f3d0"], "#d8fbff"),
  HSB: neon("hex", ["#ffffff", "#fde68a", "#c4b5fd", "#67e8f9"], "#ffffff"),
};

/**
 * 칩에 쓰는 글자(D102). 이름에 단어 `Gradient`가 들어가면 `Gr.`로 줄인다(`Rainbow Gradient` -> `Rainbow Gr.`).
 * 표시 계층에서만 바꾼다: 서버의 티어 이름(`player_tiers`)·번역 파일·본문 글자는 전체 이름 그대로고,
 * 칩의 접근 가능한 이름(aria-label)·툴팁에는 전체 이름을 쓴다. 영문 표기라서 ko·ja 화면이 같다.
 * 사이트 SVG 칩과 레이팅 카드(Canvas) 칩, 폭 계산이 모두 이 함수 하나를 거친다.
 */
export function tierChipLabel(name: string): string {
  return name.replace(/\bGradient\b/g, "Gr.");
}

/** 알 수 없는 티어 key(서버가 티어를 늘렸을 때)는 가장 낮은 티어 칩으로 그린다. 이름 글자는 그대로 나온다. */
export function tierChipOf(key: string): TierChipSpec {
  return TIER_CHIPS[key] ?? TIER_CHIPS.WHITE;
}

/** 칩 크기: 작은 칩(목록 줄)과 큰 배지(카드 위). 높이는 낮게, 글자 크기는 높이의 약 0.54배 */
export const TIER_CHIP_SIZES = {
  sm: { h: 17, fs: 11 },
  lg: { h: 26, fs: 14 },
} as const;
export type TierChipSize = keyof typeof TIER_CHIP_SIZES;

/**
 * 칩 가로 폭. 글자 폭 + 좌우 여백이고(알약 fs×2.2, 육각 fs×2.6), 짧은 이름만 최소 폭(알약 fs×7.4, 육각 fs×8.4)까지 넓힌다.
 * 긴 이름(Rainbow Gr. 등)은 넓히지 않는다. fs는 글자 크기라서 Canvas(22px)에서도 같은 비율로 쓴다.
 */
export function tierChipWidth(name: string, shape: TierChipShape, fs: number): number {
  const hex = shape === "hex";
  // 칩에 실제로 그려지는 글자(줄임말)로 잰다. 전체 이름을 넘겨도 같은 폭이라 호출하는 쪽이 줄임을 신경 쓰지 않아도 된다
  const natural = Math.round(Array.from(tierChipLabel(name)).length * fs * 0.56 + fs * (hex ? 2.6 : 2.2));
  return Math.max(natural, Math.round(fs * (hex ? 8.4 : 7.4)));
}

/** 어두운 덧칠(아래쪽 그림자 느낌)은 면이 가로 방향인 칩(하위 14티어, Rainbow 3종)에만 한다. 금속·검정 면은 하지 않는다 */
export function tierChipDarkens(spec: TierChipSpec): boolean {
  return !spec.vertical;
}

/** 위쪽 흰 하이라이트의 진하기: 금속·검정 면은 .4, 그 외 .55 */
export function tierChipHighlight(spec: TierChipSpec): number {
  return spec.border !== null && spec.vertical ? 0.4 : 0.55;
}
