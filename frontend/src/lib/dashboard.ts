import { apiFetch } from "@/lib/api";
import type { SuggestionStatus } from "@/lib/api-types";

/**
 * 관리자 대시보드(D80, ROOT 전용) 응답 모양과 보조 함수. 서버 DashboardResponse와 같다.
 * 개인이 드러나는 값(이메일·닉네임·개인 기록)은 응답에 없고 합계·날짜별 개수·티어별 인원수뿐이다. 날짜는 모두 Asia/Seoul 하루 단위다.
 * 판정 라벨(이상·경고 같은 말)은 없다. 숫자만 보여 준다.
 */

/** 고를 수 있는 기간(일). 서버도 이 세 값만 받는다(밖의 값은 400). */
export const DASHBOARD_DAYS = [7, 30, 90] as const;
export type DashboardDays = (typeof DASHBOARD_DAYS)[number];
export const DEFAULT_DASHBOARD_DAYS: DashboardDays = 7;

export interface DashboardSummary {
  /** 전체 가입자(차단 포함) */
  totalUsers: number;
  /** 기간 안에 늘어난 가입자 */
  newUsers: number;
  /** 공개 프로필 수 */
  publicProfiles: number;
  /** 공개 프로필 ÷ 전체 가입자 × 100 (소수 첫째 자리). 가입자가 0명이면 null */
  publicRatioPercent: number | null;
  recordsToday: number;
  recordsYesterday: number;
  /** 아직 처리하지 않은(접수) 건의 수 */
  pendingSuggestions: number;
}

/** 가입자 추이 한 점: 그날 새로 가입한 수와 그날 끝까지의 누적 */
export interface SignupPoint {
  date: string;
  newUsers: number;
  totalUsers: number;
}

export interface RecordPoint {
  date: string;
  records: number;
}

export interface TierRow {
  key: string;
  displayName: string;
  minScore: number;
  users: number;
}

/** 티어 분포. basis는 항상 PUBLIC_PROFILES(비공개 유저의 기록은 읽지 않는다) */
export interface TierDistribution {
  basis: string;
  /** SRN+ 기록이 있는 전체 유저 수(비공개 포함, 개수만) */
  recordedUsers: number;
  /** 그중 티어를 계산해 분포에 넣은 공개 유저 수 */
  countedUsers: number;
  rows: TierRow[];
}

export interface SuggestionStatusCount {
  status: SuggestionStatus;
  count: number;
}

export interface DashboardResponse {
  days: number;
  zone: string;
  from: string;
  to: string;
  summary: DashboardSummary;
  signups: SignupPoint[];
  records: RecordPoint[];
  tiers: TierDistribution;
  suggestions: SuggestionStatusCount[];
}

/** 쿼리 키. 보는 사람(viewerId)을 넣는 이유는 다른 관리 화면과 같다(계정이 바뀌어도 이전 캐시가 보이지 않게). */
export const dashboardKeys = {
  all: ["admin", "dashboard"] as const,
  dashboard: (viewerId: number, days: DashboardDays) => ["admin", "dashboard", viewerId, days] as const,
};

export function fetchDashboard(days: DashboardDays, signal?: AbortSignal): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/admin/dashboard", { query: { days }, signal });
}

const MINUS = "−";

/** `2026-11-15` → `11/15`. 형식이 다르면 그대로 돌려준다. */
export function dateLabel(iso: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[1]}/${match[2]}` : iso;
}

/** 부호가 글자로 같이 있는 개수 차이: `+3`, `−2`(진짜 마이너스 기호), 0은 `0`. 색에 기대지 않고 부호로 전달한다. */
export function signedCount(value: number): string {
  if (value === 0) {
    return "0";
  }
  return `${value > 0 ? "+" : MINUS}${Math.abs(value)}`;
}

/** 비율(%) 글자. 값이 없으면 `–`. */
export function ratioText(value: number | null): string {
  return value === null ? "–" : `${value.toFixed(1)}%`;
}

// ---- 꺾은선·막대 그림 좌표 -------------------------------------------------------------------

export interface SeriesPad {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SeriesLayout {
  /** 점마다의 x(가운데) */
  xs: number[];
  /** 점마다의 y */
  ys: number[];
  /** 막대 하나의 폭(막대 그림에서 쓴다) */
  barWidth: number;
  /** y축 눈금(0부터 위쪽 끝까지) */
  yTicks: { value: number; y: number }[];
  /** 그림 위쪽 끝의 값 */
  top: number;
  /** 그림 바닥(값 0)의 y */
  baseline: number;
}

/** 눈금 간격 후보. 최대값이 이 간격으로 4칸 안에 들어오는 가장 작은 값을 쓴다. */
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

/** 0부터 시작하는 y축의 위쪽 끝과 눈금 간격을 정한다(최대 4칸). 최대가 0이어도 눈금은 0과 1이 있다. */
export function niceScale(max: number): { top: number; step: number } {
  const safe = Number.isFinite(max) && max > 0 ? max : 0;
  const step = STEPS.find((s) => safe / s <= 4) ?? Math.ceil(safe / 4);
  return { top: Math.max(Math.ceil(safe / step) * step, step), step };
}

/**
 * 값 목록을 그림 좌표로 바꾼다. y는 항상 0부터 시작한다(막대 높이가 값에 비례하도록).
 * 점이 하나면 가운데에 둔다. 값이 없으면(빈 목록) 눈금만 있는 빈 그림이다.
 */
export function layoutSeries(values: readonly number[], width: number, height: number, pad: SeriesPad): SeriesLayout {
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const { top, step } = niceScale(values.length === 0 ? 0 : Math.max(...values));
  const baseline = pad.top + innerH;
  const yOf = (value: number) => baseline - (value / top) * innerH;
  const count = values.length;
  const xs = values.map((_, index) => pad.left + (count === 1 ? innerW / 2 : count <= 1 ? 0 : (index / (count - 1)) * innerW));
  const ys = values.map((value) => yOf(value));
  const yTicks: { value: number; y: number }[] = [];
  for (let value = 0; value <= top; value += step) {
    yTicks.push({ value, y: yOf(value) });
  }
  const barWidth = count === 0 ? 0 : Math.max(Math.min((innerW / count) * 0.7, 14), 1.5);
  return { xs, ys, barWidth, yTicks, top, baseline };
}

/** 그림 안의 x 위치(0..width)에 가장 가까운 점의 번호. 점이 없으면 null. */
export function nearestIndex(xs: readonly number[], x: number): number | null {
  if (xs.length === 0) {
    return null;
  }
  let best = 0;
  for (let index = 1; index < xs.length; index += 1) {
    if (Math.abs(xs[index] - x) < Math.abs(xs[best] - x)) {
      best = index;
    }
  }
  return best;
}

/** 막대 그림은 막대 사이 간격이 있어야 하므로, 날짜 글자(x축)가 겹치지 않게 보여 줄 간격을 정한다. */
export function labelStep(count: number, maxLabels: number): number {
  return Math.max(Math.ceil(count / maxLabels), 1);
}
