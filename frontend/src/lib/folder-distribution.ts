import type { DistFolder, DistUser } from "@/lib/chart-stats";
import { PLAYER_TIER_MINS } from "@/lib/chart-tier";

/**
 * 폴더 분포(D88)의 계산: 서버가 준 (유저, 0.1 폴더) 칸을 화면 단위(0.1 / 0.5)로 묶고, 점·폴더 평균·표본 부족을 정한다.
 * 점 하나 = 한 유저의 그 폴더 평균 달성률이다. 상태가 없는 순수 계산이라 화면 없이 테스트한다.
 * 판정(좋음/나쁨, 쉬움/어려움)은 어디에도 없다. 숫자와 티어(점 색)뿐이다.
 */
export type FolderUnit = "0.1" | "0.5";

export interface DistPoint {
  userId: number;
  nickname: string;
  /** player_tiers의 tier_key. 점 색은 CSS `[data-tier]`가 정한다. 티어를 모르면 null */
  tierKey: string | null;
  tierName: string | null;
  /** 이 유저가 이 묶음에서 낸 채보별 최고 달성률의 평균 */
  avg: number;
  /** 이 묶음에서 기록한 채보 수 */
  charts: number;
  /** 이 묶음의 채보 기록을 가장 최근에 저장·수정한 시각(UTC ISO, 0.5 단위면 묶인 폴더 중 가장 늦은 값). 모르면 null */
  lastRecordedAt: string | null;
}

export interface DistBucket {
  /** 묶음의 시작 기준 난이도 (0.5 단위면 8.0, 8.5 …) */
  start: number;
  /** x축 글자와 말풍선 글자: 0.1 단위는 `8.1`, 0.5 단위는 `8.0~8.4` */
  label: string;
  /** minPlayers명 이상이면 점을 그린다. 아니면 점을 그리지 않고 `표본 부족`이다(points는 비어 있다) */
  sufficient: boolean;
  /** 이 묶음의 유저 수(표본 부족이어도 센다) */
  users: number;
  points: DistPoint[];
  /** 점들의 평균(폴더 평균선). 표본 부족이면 null */
  avg: number | null;
}

/** 폴더 기준 난이도를 묶음 시작값으로. 부동소수 오차를 피하려고 10배 한 정수로 계산한다. */
export function bucketStart(tier: number, unit: FolderUnit): number {
  const tenths = Math.round(tier * 10);
  return unit === "0.1" ? tenths / 10 : (Math.floor(tenths / 5) * 5) / 10;
}

export function bucketLabel(start: number, unit: FolderUnit): string {
  if (unit === "0.1") {
    return start.toFixed(1);
  }
  return `${start.toFixed(1)}~${(start + 0.4).toFixed(1)}`;
}

/** 두 시각(UTC ISO) 중 늦은 것. 한쪽이 null이면 다른 쪽, 둘 다 null이면 null. */
function laterOf(a: string | null, b: string | null): string | null {
  if (a === null || b === null) {
    return a ?? b;
  }
  return Date.parse(b) > Date.parse(a) ? b : a;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * UTC로 저장된 시각을 Asia/Seoul 날짜 `YYYY-MM-DD`로. 한국은 서머타임이 없어 +9시간 고정이라 Intl(브라우저·ICU 설정에 따라 달라질 수 있다) 대신
 * 정수 계산으로 한다(테스트가 어느 환경에서나 같은 값). 시각이 없거나 읽을 수 없으면 null(화면은 `-`).
 */
export function kstDate(iso: string | null): string | null {
  if (iso === null) {
    return null;
  }
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 티어 key의 글자 이름. 표(PLAYER_TIER_MINS)에 없으면 서버가 준 이름을 쓴다. */
export function tierName(key: string | null, fallback: string | null = null): string | null {
  if (key === null) {
    return fallback;
  }
  return PLAYER_TIER_MINS.find((tier) => tier.key === key)?.name ?? fallback ?? key;
}

/**
 * 서버 폴더 칸을 unit 단위로 묶는다. 한 유저가 한 묶음에 낸 채보를 모두 합쳐 평균을 내므로(합 ÷ 채보 수) 0.1 단위의 평균을
 * 다시 평균하는 것이 아니라 채보마다 같은 비중이다. 묶음의 유저가 minPlayers명 미만이면 표본 부족으로 점을 비운다.
 * 결과는 기준 난이도 오름차순이고, 칸이 있는 폴더만 나온다.
 */
export function buildBuckets(folders: readonly DistFolder[], users: readonly DistUser[], unit: FolderUnit, minPlayers: number): DistBucket[] {
  const userById = new Map(users.map((user) => [user.userId, user]));
  // 묶음 → 유저 → 합산
  type Total = { charts: number; sum: number; last: string | null };
  const sums = new Map<number, Map<number, Total>>();
  for (const folder of folders) {
    const start = bucketStart(folder.tier, unit);
    const byUser = sums.get(start) ?? new Map<number, Total>();
    for (const cell of folder.cells) {
      const prev = byUser.get(cell.userId) ?? { charts: 0, sum: 0, last: null };
      byUser.set(cell.userId, { charts: prev.charts + cell.charts, sum: prev.sum + cell.sumRate, last: laterOf(prev.last, cell.lastRecordedAt) });
    }
    sums.set(start, byUser);
  }
  return [...sums.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, byUser]) => {
      const sufficient = byUser.size >= minPlayers;
      const points: DistPoint[] = sufficient
        ? [...byUser.entries()].map(([userId, total]) => {
            const user = userById.get(userId);
            const key = user?.tier?.key ?? null;
            return {
              userId,
              nickname: user?.nickname ?? "",
              tierKey: key,
              tierName: tierName(key, user?.tier?.displayName ?? null),
              avg: total.sum / total.charts,
              charts: total.charts,
              lastRecordedAt: total.last,
            };
          })
        : [];
      const avg = points.length === 0 ? null : points.reduce((acc, point) => acc + point.avg, 0) / points.length;
      return { start, label: bucketLabel(start, unit), sufficient, users: byUser.size, points, avg };
    });
}

// ---- 티어 강조 칩 ---------------------------------------------------------------------------------

export type TierGroup = "all" | "low" | "mid" | "high";
export const TIER_GROUPS: readonly TierGroup[] = ["all", "low", "mid", "high"];

function tierIndex(key: string): number {
  return PLAYER_TIER_MINS.findIndex((tier) => tier.key === key);
}

/**
 * 티어군 경계는 PLAYER_TIER_MINS(티어 표)의 순서에서 읽는다. 티어 이름이나 개수를 코드에 박지 않는다:
 * low = 처음~Red Gradient, mid = Bronze~Iridescent, high = Iridescent 다음 티어~끝(새 티어가 늘어도 표만 바뀌면 따라간다).
 */
export function tierGroupRange(group: TierGroup): { from: number; to: number } {
  const redGradient = tierIndex("RED_GRADIENT");
  const bronze = tierIndex("BRONZE");
  const iridescent = tierIndex("IRIDESCENT");
  switch (group) {
    case "low":
      return { from: 0, to: redGradient };
    case "mid":
      return { from: bronze, to: iridescent };
    case "high":
      return { from: iridescent + 1, to: PLAYER_TIER_MINS.length - 1 };
    default:
      return { from: 0, to: PLAYER_TIER_MINS.length - 1 };
  }
}

/** 칩에 보이는 이름: `~Red Gradient` / `Bronze~Iridescent` / `6 Fingers~`(표에서 읽은 티어 이름). `all`은 null(번역 문구를 쓴다). */
export function tierGroupLabel(group: TierGroup): string | null {
  if (group === "all") {
    return null;
  }
  const { from, to } = tierGroupRange(group);
  const first = PLAYER_TIER_MINS[from].name;
  const last = PLAYER_TIER_MINS[to].name;
  if (group === "low") {
    return `~${last}`;
  }
  return group === "high" ? `${first}~` : `${first}~${last}`;
}

/** 이 티어 key가 티어군에 드는가. `all`은 티어를 모르는 점(null)도 포함하고, 그 밖의 티어군은 티어를 모르면 들지 않는다. */
export function inTierGroup(key: string | null, group: TierGroup): boolean {
  if (group === "all") {
    return true;
  }
  if (key === null) {
    return false;
  }
  const index = tierIndex(key);
  if (index < 0) {
    return false;
  }
  const { from, to } = tierGroupRange(group);
  return index >= from && index <= to;
}

// ---- 그래프 좌표 ---------------------------------------------------------------------------------

export const SS_LINE = 95;
export const S_LINE = 80;

/** y축 범위: 위는 100, 아래는 점 중 가장 낮은 값을 10 단위로 내림하되 S 기준선(80)이 보이도록 70 이하로 둔다. 점이 없으면 60. */
export function yRange(buckets: readonly DistBucket[]): { min: number; max: number } {
  const values = buckets.flatMap((bucket) => bucket.points.map((point) => point.avg));
  if (values.length === 0) {
    return { min: 60, max: 100 };
  }
  const floor = Math.floor(Math.min(...values) / 10) * 10;
  return { min: Math.max(Math.min(floor, 70), 0), max: 100 };
}

/** 값을 위(0)~아래(100)의 % 위치로. 범위를 벗어나면 끝에 붙인다. */
export function yPercent(value: number, range: { min: number; max: number }): number {
  const ratio = (range.max - value) / (range.max - range.min);
  return Math.min(Math.max(ratio, 0), 1) * 100;
}

/** 정수 두 개를 [0, 1)로 섞는 해시(murmur 계열 마무리). 무작위가 아니라 같은 입력이면 늘 같은 값이다. */
function hash01(a: number, b: number): number {
  let h = Math.imul((Math.abs(a) | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((Math.abs(b) | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** 칸 안에서 점이 놓일 수 있는 가로 범위(칸 폭의 15~85%). 칸 경계에 점이 걸쳐 옆 폴더로 읽히지 않게 한다. */
const JITTER_MIN = 0.15;
const JITTER_SPAN = 0.7;

/** 유저 id와 폴더(salt)로 정한 가로 위치(칸 폭의 15~85%). 무작위가 아니라 해시라서 같은 데이터는 늘 같은 자리다(새로 그려도 점이 깜빡이지 않는다). */
export function jitterFraction(userId: number, salt = 0): number {
  return JITTER_MIN + hash01(userId, salt) * JITTER_SPAN;
}

/** slot번째 칸(0부터, 총 slots개)의 가로 위치. 칸이 하나면 가운데. */
function slotFraction(slot: number, slots: number): number {
  return slots <= 1 ? 0.5 : JITTER_MIN + (JITTER_SPAN * slot) / (slots - 1);
}

/**
 * 한 묶음 안 점들의 가로 위치(유저 id → 칸 폭의 0~1). 점이 같은 높이에 몰려도 겹치지 않게 하려는 결정적 배치다.
 * 1) 점을 높은 값 순(같으면 유저 id 순)으로 훑는다. 순서가 정해져 있으니 결과도 늘 같다.
 * 2) 점마다 해시로 선호하는 세로줄(slot)을 정하고, 그 줄에 "비슷한 높이(minGap 이내)"의 점이 이미 있으면 옆 줄로 옮긴다.
 * 3) 모든 줄이 차 있으면 선호하는 줄에 그냥 둔다(어쩔 수 없는 겹침).
 * slots = 칸 안에 점이 나란히 놓일 수 있는 수(점 지름보다 줄 간격이 넓도록 호출하는 쪽이 칸 폭에서 정한다), minGap = 겹침으로 보는 값 차이(%).
 */
export function layoutDotX(points: readonly DistPoint[], salt: number, slots: number, minGap: number): Map<number, number> {
  const n = Math.max(1, Math.floor(slots));
  const placed: { slot: number; avg: number }[] = [];
  const result = new Map<number, number>();
  for (const point of [...points].sort((a, b) => b.avg - a.avg || a.userId - b.userId)) {
    const preferred = Math.floor(hash01(point.userId, salt) * n) % n;
    let slot = preferred;
    for (let step = 0; step < n; step += 1) {
      const candidate = (preferred + step) % n;
      if (!placed.some((other) => other.slot === candidate && Math.abs(other.avg - point.avg) < minGap)) {
        slot = candidate;
        break;
      }
    }
    placed.push({ slot, avg: point.avg });
    result.set(point.userId, slotFraction(slot, n));
  }
  return result;
}

/** 폴더 평균선의 이어지는 조각들: 표본 부족 묶음은 선을 끊는다. 좌표는 % (x는 칸의 가운데). */
export function averageSegments(buckets: readonly DistBucket[], range: { min: number; max: number }): { x: number; y: number }[][] {
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  buckets.forEach((bucket, index) => {
    if (bucket.avg === null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      return;
    }
    current.push({ x: ((index + 0.5) / buckets.length) * 100, y: yPercent(bucket.avg, range) });
  });
  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}

// ---- 폴더 구간(좁은 화면에서 가로 스크롤을 줄이는 이동 칩) ----------------------------------------------

/** 한 구간이 덮는 기준 난이도 폭(0.1 단위의 정수배). 0.1 단위 = 폴더 10칸(예 6.0~6.9), 0.5 단위 = 묶음 4칸(예 6.0~7.9). 360px에서 칸이 한 화면에 들어가는 수다. */
function windowSpanTenths(unit: FolderUnit): number {
  return unit === "0.1" ? 10 : 20;
}

export interface DistWindow {
  /** 구간 시작 기준 난이도(6.0, 8.0 …) */
  start: number;
  /** 칩 글자 `6.0~6.9` */
  label: string;
  /** 이 구간에 그려지는 점 수(표본 부족 묶음의 점은 없다) */
  points: number;
}

function windowStartTenths(start: number, unit: FolderUnit): number {
  const span = windowSpanTenths(unit);
  return Math.floor(Math.round(start * 10) / span) * span;
}

/** 이 묶음이 속한 구간의 시작값 */
export function windowOf(bucket: DistBucket, unit: FolderUnit): number {
  return windowStartTenths(bucket.start, unit) / 10;
}

/** 묶음이 있는 구간만, 기준 난이도 오름차순으로. */
export function buildWindows(buckets: readonly DistBucket[], unit: FolderUnit): DistWindow[] {
  const span = windowSpanTenths(unit);
  const counts = new Map<number, number>();
  for (const bucket of buckets) {
    const tenths = windowStartTenths(bucket.start, unit);
    counts.set(tenths, (counts.get(tenths) ?? 0) + bucket.points.length);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tenths, points]) => ({
      start: tenths / 10,
      label: `${(tenths / 10).toFixed(1)}~${((tenths + span - 1) / 10).toFixed(1)}`,
      points,
    }));
}

/** 점이 가장 많은 구간의 시작값(같으면 낮은 쪽). 점이 하나도 없으면 null. 좁은 화면의 기본 구간이다. */
export function busiestWindow(windows: readonly DistWindow[]): number | null {
  let best: DistWindow | null = null;
  for (const window of windows) {
    if (window.points > 0 && (best === null || window.points > best.points)) {
      best = window;
    }
  }
  return best === null ? null : best.start;
}

/** 점이 가장 많은 티어군(같으면 low → mid → high 순). 점이 없거나 티어군에 드는 점이 없으면 all. 기본 화면의 색을 한 묶음으로 줄이는 데 쓴다. */
export function busiestGroup(buckets: readonly DistBucket[]): TierGroup {
  const counts: Record<"low" | "mid" | "high", number> = { low: 0, mid: 0, high: 0 };
  for (const bucket of buckets) {
    for (const point of bucket.points) {
      for (const group of ["low", "mid", "high"] as const) {
        if (inTierGroup(point.tierKey, group)) {
          counts[group] += 1;
        }
      }
    }
  }
  let best: TierGroup = "all";
  let bestCount = 0;
  for (const group of ["low", "mid", "high"] as const) {
    if (counts[group] > bestCount) {
      best = group;
      bestCount = counts[group];
    }
  }
  return best;
}
