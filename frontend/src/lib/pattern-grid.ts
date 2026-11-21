import { filterTierGroup, type TableFilters } from "@/lib/difficulty-table";
import type { TierGroupResponse } from "@/lib/api-types";
import type { StageCounts } from "@/components/table/StageBar";

/**
 * 서열표 `속성별` 화면(폴더 × 속성, D93)이 쓰는 계산 모음. 새 API 없이 기존 서열표 묶음 응답(채보마다 `pattern`·`mine.stage`)을
 * 화면에서 다시 센다(filterTierGroup 재사용, 홈 진행도의 속성 필터 D85와 같은 방식).
 */

/** 열이 되는 속성. `복합(단일)`·`레이팅 제외`·속성 없음은 어느 열에도 세지 않는다(홈 진행도 속성 칩과 같은 규칙, D85). */
export const GRID_PATTERNS = ["단일", "복합", "이중", "삼중"] as const;
export type GridPattern = (typeof GRID_PATTERNS)[number];

/** 주소의 `?pattern=` 값을 열 이름으로. 허용 값(화이트리스트)이 아니면 null(무시한다). 사용자가 주소를 고칠 수 있으므로 문자열 비교만 한다. */
export function parseGridPattern(raw: string | null): GridPattern | null {
  return GRID_PATTERNS.find((p) => p === raw) ?? null;
}

/** 폴더 상세로 가는 주소. 속성 값은 주소에 안전하게 넣는다(한글 퍼센트 인코딩). */
export function patternFolderHref(folderHref: string, pattern: GridPattern): string {
  return `${folderHref}?pattern=${encodeURIComponent(pattern)}`;
}

export interface GridCell extends StageCounts {
  total: number;
  recorded: number;
}

export interface GridRow {
  tier: number;
  cells: Record<GridPattern, GridCell>;
}

export interface PatternGrid {
  rows: GridRow[];
  /** 열 머리에 보이는 속성별 채보 수(행들의 합, 같은 필터를 적용한 값) */
  columnTotals: Record<GridPattern, number>;
}

/**
 * 폴더 × 속성 집계. 칸 하나 = (기준 난이도, 속성) 한 쌍의 채보들. 속성 필터는 칸 자체가 대신하므로 무시하고,
 * 추천 필터 등 나머지는 서열표 폴더 화면과 같게 적용한다(칸을 눌러 들어간 폴더의 n/전체가 칸과 같도록).
 * 미정 묶음(tier null)과, 걸러진 뒤 채보가 하나도 없는 난이도 행은 만들지 않는다.
 */
export function buildPatternGrid(groups: readonly TierGroupResponse[], filters: TableFilters): PatternGrid {
  const columnTotals: Record<GridPattern, number> = { 단일: 0, 복합: 0, 이중: 0, 삼중: 0 };
  const rows: GridRow[] = [];
  for (const g of groups) {
    if (g.tier === null) continue;
    const cells = {} as Record<GridPattern, GridCell>;
    let any = false;
    for (const p of GRID_PATTERNS) {
      const f = filterTierGroup(g, { ...filters, pattern: [p] });
      cells[p] = { total: f.total, recorded: f.recorded, exc: f.exc, fc: f.fc, ss: f.ss, sPlus: f.sPlus, s: f.s, belowS: f.belowS };
      columnTotals[p] += f.total;
      any = any || f.total > 0;
    }
    if (any) rows.push({ tier: g.tier, cells });
  }
  return { rows, columnTotals };
}
