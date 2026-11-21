import { apiFetch } from "@/lib/api";
import type { PlayerTierResponse } from "@/lib/api-types";
import { difficultyLabel, formatPlayedDate, formatRate, partLabel } from "@/lib/format";
import type { AchievementStage, DifficultyType, InstrumentPart } from "@/lib/types";

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

/** 폴더 분포(D88): 한 유저의 한 폴더(0.1 단위). 평균 달성률 = sumRate / charts. */
export interface DistCell {
  userId: number;
  charts: number;
  sumRate: number;
  /** 그 폴더의 채보 기록을 이 유저가 가장 최근에 저장·수정한 시각(UTC ISO). 모르면 null */
  lastRecordedAt: string | null;
}

export interface DistFolder {
  tier: number;
  cells: DistCell[];
}

/** 점 색·말풍선용 유저. tier는 서버가 레이팅 총점으로 구한 티어(없으면 null). 이메일·역할·Google ID는 오지 않는다. */
export interface DistUser {
  userId: number;
  nickname: string;
  tier: PlayerTierResponse | null;
  totalScore: number;
}

export interface FolderDistributionPage {
  content: DistFolder[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  users: DistUser[];
  meta: ChartStatsMeta;
}

/**
 * 폴더 분포 상세(D97): 한 유저의 한 폴더(0.5 묶음이면 tierFrom~tierTo) 평균에 어떤 곡이 들어갔는지.
 * countedCharts·sumRate·avgRate는 점 도표·표와 같은 조건으로 센 값이라 sumRate ÷ countedCharts = avgRate다.
 * 서버 ChartStatsResponse.FolderUserRecords와 같다. 이메일·역할·Google ID는 오지 않는다.
 */
export interface FolderRecord {
  chart: StatsChart;
  bestRate: number;
  fullCombo: boolean;
  stage: AchievementStage;
  /** 그 채보 기록을 마지막으로 저장·수정한 시각(UTC ISO). 모르면 null */
  savedAt: string | null;
  /** false = 같은 폴더에 기록은 있지만 레이팅에 계산되지 않아 평균에서 빠진 곡 */
  counted: boolean;
}

export interface FolderUserRecords {
  userId: number;
  nickname: string;
  tierFrom: number;
  tierTo: number;
  countedCharts: number;
  sumRate: number;
  /** 평균에 든 곡이 없으면 null */
  avgRate: number | null;
  excludedCharts: number;
  content: FolderRecord[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
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
/** 폴더 기록 상세의 묶음 단위(폴더 분포의 단위 칩과 같다). 0.1 = 폴더 하나, 0.5 = 0.5 단위 묶음 */
export type FolderRecordUnit = "0.1" | "0.5";
export type ChartStatsTab = "deviation" | "popularity" | "distribution" | "undecided";

export const CHART_STATS_TABS: readonly ChartStatsTab[] = ["deviation", "popularity", "distribution", "undecided"];
export const DEVIATION_SORTS: readonly DeviationSort[] = ["deviation", "avg", "players"];
export const POPULARITY_RANGES: readonly PopularityRange[] = ["all", "7d"];
export const PLAYER_SORTS: readonly PlayerSort[] = ["rate", "score", "plays"];
export const CHART_STATS_PAGE_SIZE = 20;
/** 폴더 분포는 그래프가 한 번에 모두 받는다(서버 최대 100폴더). */
export const FOLDER_PAGE_SIZE = 100;
/** 폴더 기록 상세 한 쪽의 곡 수(서버 최대 100). 평균·합계는 모든 곡으로 내므로 쪽을 넘겨도 같다. */
export const FOLDER_RECORDS_PAGE_SIZE = 50;

/** 조회 키. 보는 사람(viewerId)을 넣는 이유는 다른 관리 화면과 같다(계정이 바뀌어도 이전 계정의 캐시가 보이지 않게). */
export const chartStatsKeys = {
  all: ["admin", "chart-stats"] as const,
  deviation: (viewerId: number, sort: DeviationSort, page: number) => ["admin", "chart-stats", "deviation", viewerId, sort, page] as const,
  popularity: (viewerId: number, range: PopularityRange, page: number) => ["admin", "chart-stats", "popularity", viewerId, range, page] as const,
  folderDistribution: (viewerId: number) => ["admin", "chart-stats", "folder-distribution", viewerId] as const,
  folderUserRecords: (viewerId: number, folder: number, unit: FolderRecordUnit, userId: number, page: number) =>
    ["admin", "chart-stats", "folder-user-records", viewerId, folder, unit, userId, page] as const,
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

export function fetchFolderDistribution(signal?: AbortSignal): Promise<FolderDistributionPage> {
  return apiFetch<FolderDistributionPage>(`${BASE}/folder-distribution`, { query: { page: 0, size: FOLDER_PAGE_SIZE }, signal });
}

/** 폴더 기록 상세. folder는 묶음의 시작 기준 난이도(6.4, 0.5 묶음이면 6.0). 소수 첫째 자리로 맞춰 보낸다. */
export function fetchFolderUserRecords(
  folder: number,
  unit: FolderRecordUnit,
  userId: number,
  page: number,
  signal?: AbortSignal,
): Promise<FolderUserRecords> {
  return apiFetch<FolderUserRecords>(`${BASE}/folders/${folder.toFixed(1)}/users/${userId}/records`, {
    query: { unit, page, size: FOLDER_RECORDS_PAGE_SIZE },
    signal,
  });
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

/**
 * `최근 N일`의 실제 날짜 범위를 `11-15~11-21`로 만든다(Asia/Seoul 날짜, 오늘 포함 N일). 서버가 세는 범위와 같다:
 * 서울 기준 오늘 0시에서 N-1일 전 0시까지 거슬러 올라간 시각부터 지금까지(ChartStatsService). 서버는 이 범위를 내려주지 않으므로
 * 화면이 같은 규칙으로 계산한다. `now`는 테스트에서 날짜를 고정하려고 받는다. 날짜를 읽을 수 없으면 null.
 */
export function recentRangeText(days: number, now: Date = new Date()): string | null {
  const today = formatPlayedDate(now.toISOString());
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!match || !Number.isInteger(days) || days < 1) {
    return null;
  }
  // 서울 날짜의 연-월-일을 UTC 자정으로 두고 일 수만 뺀다(시간대·서머타임 영향 없음)
  const end = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const start = new Date(end - (days - 1) * 24 * 60 * 60 * 1000);
  const md = (ms: number | Date) => new Date(ms).toISOString().slice(5, 10);
  return `${md(start)}~${md(end)}`;
}
