/**
 * 레이팅 설명서(/guide)의 상수표 계산. 백엔드(SkillService)의 수식을 화면 설명용으로 그대로 옮긴 것이다.
 *
 * 계수는 서버의 `app_settings`(rating.*)에 있지만 그 조회 API는 ROOT 전용이라 설명서 화면이 읽을 수 없다.
 * 그래서 시드(V1)의 기본값을 여기 한 곳에 두고 표를 계산한다. 서버 설정을 바꾸면 이 값도 같이 고쳐야 한다.
 * (설정을 읽는 공개 API를 만들면 이 상수는 그 응답으로 바꿀 수 있다.)
 */
export interface RatingCoefficients {
  /** 이 값보다 큰 기준 난이도에는 high 식, 아니면 low 식 (rating.pivot) */
  pivot: number;
  highSlope: number;
  highOffset: number;
  lowSlope: number;
  lowOffset: number;
  /** 달성률이 이 값까지는 R에 비례 (rating.cap_rate) */
  capRate: number;
  /** 이 값부터는 가산점이 다 찬다 (rating.max_rate) */
  maxRate: number;
  /** 가산점 최대치 (rating.bonus) */
  bonus: number;
  /** 화면 점수 = V × 이 값 (rating.score_multiplier) */
  multiplier: number;
}

export const DEFAULT_COEFFICIENTS: RatingCoefficients = {
  pivot: 6.0,
  highSlope: 5,
  highOffset: 15,
  lowSlope: 10,
  lowOffset: 45,
  capRate: 80,
  maxRate: 95,
  bonus: 3.2,
  multiplier: 20,
};

/** 표에 보이는 달성률 열 */
export const GUIDE_RATES = [70, 75, 80, 85, 90, 95] as const;

/** 표의 기준 난이도 범위(0.1 단위 정수: 70 = 7.0). 높은 난이도가 위. */
export const GUIDE_TIER_MAX = 70;
export const GUIDE_TIER_MIN = 49;

/**
 * 레이팅상수 R. 기준 난이도 T는 0.1 단위 정수(tenths)로 받아 부동소수 오차를 피한다 (6.0 -> 60).
 * T > pivot 이면 slope×T − offset, 아니면 low 식. 경계(T = pivot)는 low 식이다.
 */
export function ratingConstant(tenths: number, c: RatingCoefficients = DEFAULT_COEFFICIENTS): number {
  const t = tenths / 10;
  return t > c.pivot ? c.highSlope * t - c.highOffset : c.lowSlope * t - c.lowOffset;
}

/** 채보 값 V = R × min(A, cap)/100 + bonus × min(max(A − cap, 0), max − cap)/(max − cap) */
export function chartValue(r: number, rate: number, c: RatingCoefficients = DEFAULT_COEFFICIENTS): number {
  const span = c.maxRate - c.capRate;
  return (r * Math.min(rate, c.capRate)) / 100 + (c.bonus * Math.min(Math.max(rate - c.capRate, 0), span)) / span;
}

/** 화면 점수 = V × multiplier (소수 그대로, 표시할 때만 반올림한다) */
export function chartScore(tenths: number, rate: number, c: RatingCoefficients = DEFAULT_COEFFICIENTS): number {
  return chartValue(ratingConstant(tenths, c), rate, c) * c.multiplier;
}

export interface GuideRow {
  /** 화면에 보이는 기준 난이도 `6.0` */
  tier: string;
  /** 내부 상수 R. 정수면 `15`, 아니면 소수 첫째 자리 `16.5` */
  constant: string;
  cells: { rate: number; score: number }[];
}

/** 상수표 행들(높은 난이도 먼저). score는 정수로 반올림한 표시값이다. */
export function guideRows(c: RatingCoefficients = DEFAULT_COEFFICIENTS): GuideRow[] {
  const rows: GuideRow[] = [];
  for (let tenths = GUIDE_TIER_MAX; tenths >= GUIDE_TIER_MIN; tenths--) {
    const r = ratingConstant(tenths, c);
    rows.push({
      tier: (tenths / 10).toFixed(1),
      constant: Number.isInteger(r) ? String(r) : r.toFixed(1),
      // 1e-9: 15.5처럼 정확히 .5인 값이 부동소수 때문에 내림되는 것을 막는다
      cells: GUIDE_RATES.map((rate) => ({ rate, score: Math.round(chartScore(tenths, rate, c) + 1e-9) })),
    });
  }
  return rows;
}

// ---- 칸 색: 점수가 높을수록 노랑 → 연두 → 하늘 → 보라 → 분홍 → 짙은 빨강 → 거의 검정으로 이어지는 그라데이션 ----

type Rgb = [number, number, number];

/** 색이 칠해지는 점수 범위(표의 최소·최대 점수)와 지점. 지점 사이는 RGB를 직선으로 섞는다. */
export const SCORE_MIN = 56;
export const SCORE_MAX = 384;
const STOPS: readonly [number, Rgb][] = [
  [56, [255, 240, 120]],
  [100, [170, 235, 140]],
  [145, [100, 215, 235]],
  [200, [190, 160, 240]],
  [255, [255, 140, 170]],
  [315, [225, 80, 90]],
  [384, [30, 20, 30]],
];

const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export function scoreColor(score: number): Rgb {
  const x = Math.min(Math.max(score, SCORE_MIN), SCORE_MAX);
  let i = 0;
  while (i < STOPS.length - 2 && x > STOPS[i + 1][0]) {
    i++;
  }
  const [v0, c0] = STOPS[i];
  const [v1, c1] = STOPS[i + 1];
  const t = (x - v0) / (v1 - v0);
  return [mix(c0[0], c1[0], t), mix(c0[1], c1[1], t), mix(c0[2], c1[2], t)];
}

const linear = (channel: number) => {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** 상대 밝기(0 어두움 ~ 1 밝음) */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export const TEXT_ON_LIGHT = "#000000";
export const TEXT_ON_DARK = "#FFFFFF";

/**
 * 칸 배경에 올릴 글자색. 순수 검정은 배경 밝기 0.175 이상에서, 흰색은 0.183 이하에서 대비 4.5 이상이다.
 * 두 구간이 겹쳐서 0.18을 기준으로 고르면 모든 칸이 4.5를 넘는다. (검정이 순수 검정이 아니면 이 구간이 어긋난다.)
 * 테마와 상관없이 칸마다 배경이 정해져 있어 테마별 색을 두지 않는다.
 */
export function textColorOn(rgb: Rgb): string {
  return luminance(rgb) > 0.18 ? TEXT_ON_LIGHT : TEXT_ON_DARK;
}

export function rgbCss([r, g, b]: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** 범례 막대용 그라데이션 (왼쪽 최소 점수 → 오른쪽 최대 점수) */
export function legendGradient(steps = 12): string {
  const colors: string[] = [];
  for (let k = 0; k <= steps; k++) {
    colors.push(rgbCss(scoreColor(SCORE_MIN + ((SCORE_MAX - SCORE_MIN) * k) / steps)));
  }
  return `linear-gradient(90deg, ${colors.join(", ")})`;
}

/** 범례 눈금(왼쪽부터 7칸) */
export function legendTicks(): number[] {
  return [0, 1, 2, 3, 4, 5, 6].map((k) => Math.round(SCORE_MIN + ((SCORE_MAX - SCORE_MIN) * k) / 6));
}

/**
 * 달성률 1%당 오르는 점수 (설명서 참고사항용).
 * - 가산 구간(capRate~maxRate, 기본 80~95%): 곡 난이도와 관계없이 bonus × multiplier ÷ (maxRate − capRate) = 3.2×20÷15 ≈ 4.27점
 * - 그 아래(0~capRate%): R × multiplier ÷ 100 = 레이팅상수 R의 0.2배 (R=20이면 4점)
 */
export function pointsPerPercentAboveCap(c: RatingCoefficients = DEFAULT_COEFFICIENTS): number {
  return (c.bonus * c.multiplier) / (c.maxRate - c.capRate);
}

export function pointsPerPercentBelowCap(r: number, c: RatingCoefficients = DEFAULT_COEFFICIENTS): number {
  return (r * c.multiplier) / 100;
}
