/**
 * 서열표 첫 화면(난이도 타일 격자)이 쓰는 계산·기억 모음.
 *
 * 평균 난이도는 새로 계산하지 않는다: 서버 `GET /skills/me/play-level`(세트리스트 추천과 같은 PlayLevelEstimator)이 준 값을 그대로 쓴다.
 * 여기서는 그 값에 가장 가까운 타일을 고르고, 평균 근처 3칸만 보이게 나머지를 접을 범위를 정한다.
 * 소수 비교는 0.1 단위 정수(tenths)로 한다(5.8 + 0.1 같은 부동소수 오차로 경계가 어긋나지 않게).
 */

export type TileOrder = "hard" | "easy";

/** 평균 타일에서 가까운 쪽으로 보여 줄 칸 수 (예: 평균 5.8이면 5.9·6.0·6.1). */
export const NEAR_TILES = 3;
/** 접힌 줄이 이 개수 미만이면 접어도 이득이 없어서(타일 한 칸을 줄 하나로 바꿀 뿐) 접지 않는다. */
export const MIN_FOLD = 2;

const tenths = (tier: number) => Math.round(tier * 10);

/** 정렬 기본값: 평균이 있으면 어려운 순(예전 그대로), 없으면(기록 없음·비로그인·근거 부족) 쉬운 순. */
export function defaultOrder(hasAverage: boolean): TileOrder {
  return hasAverage ? "hard" : "easy";
}

export interface TileLayout<T extends { tier: number }> {
  /** 정렬된 전체 타일 */
  ordered: T[];
  /** 평균 타일 앞쪽(정렬 방향 기준)에서 접을 수 있는 타일. 접을 게 없으면 빈 배열 */
  folded: T[];
  /** 평균에 가장 가까운 타일의 기준 난이도. 평균이 없거나 타일이 없으면 null */
  averageTier: number | null;
}

/**
 * 타일 순서와 접을 범위를 정한다.
 * - 어려운 순: 높은 난이도부터. 평균 위로 NEAR_TILES칸까지 보이고 그 위(더 높은 난이도)는 접는다.
 * - 쉬운 순: 낮은 난이도부터. 평균 아래로 NEAR_TILES칸까지 보이고 그 아래(더 낮은 난이도)는 접는다.
 * - 평균이 맨 앞에 있으면(앞쪽 타일이 NEAR_TILES 이하) 접을 것이 없다.
 * 평균 값이 타일 사이에 있으면(예: 5.85인데 5.9 타일이 없음) 가장 가까운 타일을 평균 타일로 본다(같은 거리면 낮은 쪽).
 */
export function layoutTiles<T extends { tier: number }>(items: readonly T[], average: number | null, order: TileOrder): TileLayout<T> {
  const ordered = [...items].sort((a, b) => (order === "hard" ? tenths(b.tier) - tenths(a.tier) : tenths(a.tier) - tenths(b.tier)));
  if (average === null || ordered.length === 0) {
    return { ordered, folded: [], averageTier: null };
  }
  const target = tenths(average);
  let averageIndex = 0;
  for (let i = 1; i < ordered.length; i++) {
    const best = Math.abs(tenths(ordered[averageIndex].tier) - target);
    const now = Math.abs(tenths(ordered[i].tier) - target);
    if (now < best || (now === best && tenths(ordered[i].tier) < tenths(ordered[averageIndex].tier))) {
      averageIndex = i;
    }
  }
  const foldCount = Math.max(0, averageIndex - NEAR_TILES);
  return {
    ordered,
    folded: foldCount >= MIN_FOLD ? ordered.slice(0, foldCount) : [],
    averageTier: ordered[averageIndex].tier,
  };
}

/** 접힌 줄에 쓰는 범위(작은 값~큰 값). 예: 6.4~7.0 */
export function foldRange(folded: readonly { tier: number }[]): { from: string; to: string } {
  const values = folded.map((f) => tenths(f.tier));
  return { from: (Math.min(...values) / 10).toFixed(1), to: (Math.max(...values) / 10).toFixed(1) };
}

/** 서버가 준 평균(소수 둘째 자리)을 표시용 0.1 단위로 맞춘다. 헤더 숫자와 평균 타일이 같은 값을 가리키게 한다. */
export function averageTenth(average: number): number {
  return tenths(average) / 10;
}

/**
 * 첫 진입 연출(평균 타일 빛남·스크롤)을 이 탭에서 이미 했는가.
 * 폴더에 갔다가 돌아왔을 때 다시 하지 않으려고 기억한다. 메모리 + sessionStorage(이 탭 한정, 값은 "1" 하나뿐).
 * 저장소를 못 쓰면 메모리에만 남아서 화면 이동으로는 유지되고 새로고침하면 다시 한다.
 */
const INTRO_KEY = "srp.tableTilesIntro";
let introPlayed = false;

export function wasIntroPlayed(): boolean {
  if (introPlayed) return true;
  try {
    introPlayed = sessionStorage.getItem(INTRO_KEY) === "1";
  } catch {
    // 읽을 수 없으면 아직 안 한 것으로 본다
  }
  return introPlayed;
}

export function markIntroPlayed(): void {
  introPlayed = true;
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    // 저장할 수 없어도 이번 탭의 화면 이동에서는 메모리 값으로 유지된다
  }
}

/** 첫 방문 안내 말풍선을 닫았는가(이 기기). localStorage는 per-viewer 편의로만 쓰고, 읽기·쓰기가 실패해도 화면은 정상이다. */
export const TIP_SEEN_KEY = "srp.tableTilesTipSeen";

export function wasTipSeen(): boolean {
  try {
    return localStorage.getItem(TIP_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTipSeen(): void {
  try {
    localStorage.setItem(TIP_SEEN_KEY, "1");
  } catch {
    // 저장할 수 없어도 이번 화면에서는 닫힌다
  }
}

/** 테스트용: 메모리 값을 비운다 */
export function resetTableTilesForTest(): void {
  introPlayed = false;
}
