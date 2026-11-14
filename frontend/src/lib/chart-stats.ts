import { apiFetch } from "@/lib/api";
import type { PlayerTierResponse } from "@/lib/api-types";
import { difficultyLabel, formatRate, partLabel } from "@/lib/format";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/**
 * 서열표 분석(D77, ROOT·ADMIN) 응답 모양. 서버 ChartStatsResponse와 같다.
 * 숫자와 순서만 있고 판정(쉬움/어려움, 역전, 적정 같은 라벨)은 어디에도 없다. null은 "표본 부족"이다
 * (플레이어 3명 미만, 폴더 비교 곡 3개 미만). 이메일·역할·Google ID는 오지 않는다.
 */
export interface ChartStatsMeta {
  /** 집계 기준의 공개 유저 수 */
  publicUsers: number;
  minPlayers: number;
  minFolderCharts: number;
  recentDays: number;
}

export interface ChartStatsPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  meta: ChartStatsMeta;
}

export interface StatsChart {
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  /** 서열표 기준 난이도. 없으면 null(미정) */
  tier: number | null;
}

export interface DeviationRow {
  chart: StatsChart;
  players: number;
  records: number;
  avgRate: number | null;
  folderAvgRate: number | null;
  deviation: number | null;
  folderSampleCharts: number;
}

export interface PopularityRow {
  chart: StatsChart;
  records: number;
  players: number;
  recentRecords: number;
}

export interface FolderRow {
  tier: number;
  chartCount: number;
  sampledCharts: number;
  avgRate: number | null;
  deltaFromPrevious: number | null;
}

export interface UndecidedRow {
  chart: StatsChart;
  records: number;
  players: number;
}

export interface ChartStatsSummary {
  chart: StatsChart;
  players: number;
  records: number;
  avgRate: number | null;
  medianRate: number | null;
  folderAvgRate: number | null;
  deviation: number | null;
  folderSampleCharts: number;
  meta: ChartStatsMeta;
}

export interface StatsPlayerRow {
  userId: number;
  nickname: string;
  tier: PlayerTierResponse | null;
  totalScore: number;
  bestRate: number;
  playCount: number;
  lastPlayedAt: string | null;
}

export type DeviationSort = "deviation" | "avg" | "players";
export type PopularityRange = "all" | "7d";
export type PlayerSort = "rate" | "score" | "plays";
export type ChartStatsTab = "deviation" | "popularity" | "folders" | "undecided";

export const CHART_STATS_TABS: readonly ChartStatsTab[] = ["deviation", "popularity", "folders", "undecided"];
export const DEVIATION_SORTS: readonly DeviationSort[] = ["deviation", "avg", "players"];
export const POPULARITY_RANGES: readonly PopularityRange[] = ["all", "7d"];
export const PLAYER_SORTS: readonly PlayerSort[] = ["rate", "score", "plays"];
export const CHART_STATS_PAGE_SIZE = 20;
/** 폴더 곡선은 그래프가 한 번에 모두 받는다(서버 최대 100). 폴더는 수십 개다. */
export const FOLDER_PAGE_SIZE = 100;

/** 조회 키. 보는 사람(viewerId)을 넣는 이유는 다른 관리 화면과 같다(계정이 바뀌어도 이전 계정의 캐시가 보이지 않게). */
export const chartStatsKeys = {
  all: ["admin", "chart-stats"] as const,
  deviation: (viewerId: number, sort: DeviationSort, page: number) => ["admin", "chart-stats", "deviation", viewerId, sort, page] as const,
  popularity: (viewerId: number, range: PopularityRange, page: number) => ["admin", "chart-stats", "popularity", viewerId, range, page] as const,
  folders: (viewerId: number) => ["admin", "chart-stats", "folders", viewerId] as const,
  undecided: (viewerId: number, page: number) => ["admin", "chart-stats", "undecided", viewerId, page] as const,
  summary: (viewerId: number, chartId: number) => ["admin", "chart-stats", "summary", viewerId, chartId] as const,
  players: (viewerId: number, chartId: number, sort: PlayerSort, page: number) =>
    ["admin", "chart-stats", "players", viewerId, chartId, sort, page] as const,
};

const BASE = "/admin/chart-stats";

export function fetchDeviation(sort: DeviationSort, page: number, signal?: AbortSignal): Promise<ChartStatsPage<DeviationRow>> {
  return apiFetch<ChartStatsPage<DeviationRow>>(`${BASE}/deviation`, { query: { sort, page, size: CHART_STATS_PAGE_SIZE }, signal });
}

export function fetchPopularity(range: PopularityRange, page: number, signal?: AbortSignal): Promise<ChartStatsPage<PopularityRow>> {
  return apiFetch<ChartStatsPage<PopularityRow>>(`${BASE}/popularity`, { query: { range, page, size: CHART_STATS_PAGE_SIZE }, signal });
}

export function fetchFolders(signal?: AbortSignal): Promise<ChartStatsPage<FolderRow>> {
  return apiFetch<ChartStatsPage<FolderRow>>(`${BASE}/folders`, { query: { page: 0, size: FOLDER_PAGE_SIZE }, signal });
}

export function fetchUndecided(page: number, signal?: AbortSignal): Promise<ChartStatsPage<UndecidedRow>> {
  return apiFetch<ChartStatsPage<UndecidedRow>>(`${BASE}/undecided`, { query: { page, size: CHART_STATS_PAGE_SIZE }, signal });
}

export function fetchChartSummary(chartId: number, signal?: AbortSignal): Promise<ChartStatsSummary> {
  return apiFetch<ChartStatsSummary>(`${BASE}/charts/${chartId}/summary`, { signal });
}

export function fetchChartPlayers(
  chartId: number,
  sort: PlayerSort,
  page: number,
  signal?: AbortSignal,
): Promise<ChartStatsPage<StatsPlayerRow>> {
  return apiFetch<ChartStatsPage<StatsPlayerRow>>(`${BASE}/charts/${chartId}/players`, {
    query: { sort, page, size: CHART_STATS_PAGE_SIZE },
    signal,
  });
}

// ---- 표시 도우미 ------------------------------------------------------------------------------------

const MINUS = "−"; // −

/** 달성률 평균·중앙값: 소수 둘째 자리 + `%`. 100.00은 MAX가 아니라 숫자 그대로 보인다(평균이라 MAX 표기를 쓰지 않는다). null이면 null. */
export function averageText(value: number | null): string | null {
  return value === null ? null : `${value.toFixed(2)}%`;
}

/** 부호가 글자로 같이 있는 편차(%p): `+2.35%p`, `−2.35%p`(진짜 마이너스 기호), 0은 `0.00%p`. 색에 기대지 않고 부호로 전달한다. */
export function signedText(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  if (rounded === 0) {
    return "0.00%p";
  }
  return `${value > 0 ? "+" : MINUS}${rounded.toFixed(2)}%p`;
}

/** 서열표 기준 난이도(0.1 단위) 글자. 없으면 null(화면이 `미정`을 쓴다). */
export function tierText(tier: number | null): string | null {
  return tier === null ? null : tier.toFixed(1);
}

/** `Guitar | MAS 9.93` 처럼 파트와 난이도가 한 덩어리인 글자(서열표·세트리스트 줄과 같은 표기). */
export function chartKindText(chart: Pick<StatsChart, "part" | "difficulty" | "level">): string {
  return `${partLabel(chart.part)} | ${difficultyLabel(chart.difficulty)} ${chart.level.toFixed(2)}`;
}

/** 채보 상세 화면 주소 */
export function chartStatsHref(chartId: number): string {
  return `/admin/chart-stats/${chartId}`;
}

/** 이 채보의 달성률(유저 줄): 100.00은 MAX, 그 외 둘째 자리. 유저 한 명의 값이라 다른 화면과 같은 규칙이다. */
export function bestRateText(rate: number): string {
  const text = formatRate(rate);
  return text === "MAX" ? text : `${text}%`;
}

// ---- 막대(장식) 계산 --------------------------------------------------------------------------------

/** 편차 막대가 한쪽으로 가득 차는 크기(%p). 이보다 크면 끝에 모은다(숫자 글자는 그대로 보인다). */
export const DEVIATION_BAR_RANGE = 10;

/**
 * 가운데(0)에서 좌우로 뻗는 편차 막대의 한쪽 길이(0~100, %). 부호는 방향이 아니라 호출하는 쪽이 정한다.
 * null이면 0. 숫자 글자가 값을 담으므로 막대는 장식(aria-hidden)이다.
 */
export function deviationBarPercent(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.abs(value) / DEVIATION_BAR_RANGE, 1) * 100;
}

/** 값 목록 안에서 가장 큰 값 대비 비율(0~100, %). 인기 막대용. 최댓값이 0이면 0. */
export function ratioPercent(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value / max, 0), 1) * 100;
}

// ---- 폴더 곡선(SVG) ---------------------------------------------------------------------------------

export interface CurvePoint {
  tier: number;
  x: number;
  y: number;
  avg: number;
  row: FolderRow;
}

export interface CurveLayout {
  /** 폴더마다의 x 좌표(표본 부족 폴더 자리도 포함, x축 글자용) */
  xs: number[];
  points: CurvePoint[];
  /** 이어서 그릴 선 조각들. 표본 부족 폴더(평균 null)는 선을 끊는다(건너뛴 곳에는 선을 긋지 않는다). */
  segments: CurvePoint[][];
  /** y축 눈금(달성률, %) */
  yTicks: { value: number; y: number }[];
  min: number;
  max: number;
}

/**
 * 폴더 곡선 좌표. x는 폴더 순서(기준 난이도 오름차순)를 같은 간격으로 놓고, y는 평균 달성률을 보이는 범위(5의 배수로 맞춘 최소~최대)에 맞춘다.
 * 표본 부족 폴더는 점이 없고 그 자리는 비워 둔다(x 칸은 남긴다). 점이 하나도 없으면 빈 배치를 돌려준다.
 */
export function layoutCurve(rows: readonly FolderRow[], width: number, height: number, pad: { left: number; right: number; top: number; bottom: number }): CurveLayout {
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const avgs = rows.map((r) => r.avgRate).filter((v): v is number => v !== null);
  if (rows.length === 0 || avgs.length === 0) {
    return { xs: [], points: [], segments: [], yTicks: [], min: 0, max: 0 };
  }
  const min = Math.floor(Math.min(...avgs) / 5) * 5;
  const max = Math.max(Math.ceil(Math.max(...avgs) / 5) * 5, min + 5);
  const yOf = (value: number) => pad.top + innerH - ((value - min) / (max - min)) * innerH;
  const xOf = (index: number) => pad.left + (rows.length === 1 ? innerW / 2 : (index / (rows.length - 1)) * innerW);

  const points: CurvePoint[] = [];
  const segments: CurvePoint[][] = [];
  let current: CurvePoint[] = [];
  rows.forEach((row, index) => {
    if (row.avgRate === null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      return;
    }
    const point = { tier: row.tier, x: xOf(index), y: yOf(row.avgRate), avg: row.avgRate, row };
    points.push(point);
    current.push(point);
  });
  if (current.length > 0) {
    segments.push(current);
  }
  const yTicks: { value: number; y: number }[] = [];
  for (let value = min; value <= max; value += 5) {
    yTicks.push({ value, y: yOf(value) });
  }
  return { xs: rows.map((_, index) => xOf(index)), points, segments, yTicks, min, max };
}
