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
  const sums = new Map<number, Map<number, { charts: number; sum: number }>>();
  for (const folder of folders) {
    const start = bucketStart(folder.tier, unit);
    const byUser = sums.get(start) ?? new Map<number, { charts: number; sum: number }>();
    for (const cell of folder.cells) {
      const prev = byUser.get(cell.userId) ?? { charts: 0, sum: 0 };
      byUser.set(cell.userId, { charts: prev.charts + cell.charts, sum: prev.sum + cell.sumRate });
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

/** 같은 묶음 안에서 점이 겹치지 않도록 유저 id로 정한 가로 위치(칸 폭의 20~80%). 같은 유저는 늘 같은 자리다(깜빡이지 않는다). */
export function jitterFraction(userId: number): number {
  return 0.2 + ((Math.abs(userId) * 37) % 61) / 100;
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
