import type { ChartFolderResponse } from "@/lib/api-types";
import type { ProgressGroup, TableProgress } from "@/lib/difficulty-table";
import { folderTitle } from "@/lib/song-list";

/**
 * 홈 진행도 카드가 쓰는 계산 모음. 서열표 탭과 곡 목록 탭이 같은 모양(TableProgress: 전체 합계 + 묶음별 줄)을 쓰도록
 * 곡 목록 쪽도 같은 형태로 바꿔 준다. 개수는 서버가 준 값을 합치기만 하고 채보를 화면에서 다시 세지 않는다.
 */
export type ProgressSummary = TableProgress;

/** 곡 목록의 레벨 폴더(0.5 단위)를 진행도 형태로. 폴더 순서는 서버 그대로이고, 줄을 누르면 곡 목록으로 간다. */
export function folderProgress(folders: readonly ChartFolderResponse[]): ProgressSummary {
  const sum = (pick: (f: ChartFolderResponse) => number) => folders.reduce((acc, f) => acc + pick(f), 0);
  return {
    total: sum((f) => f.total),
    recorded: sum((f) => f.recorded),
    exc: sum((f) => f.exc),
    fc: sum((f) => f.fc),
    ss: sum((f) => f.ss),
    s: sum((f) => f.s),
    belowS: sum((f) => f.belowS),
    groups: folders.map((f) => ({
      key: String(f.lo),
      label: folderTitle(f),
      // 곡 목록에는 폴더마다 따로 주소가 없다(한 화면에서 펼친다). 곡 목록으로 보낸다
      href: "/songs",
      total: f.total,
      recorded: f.recorded,
      exc: f.exc,
      fc: f.fc,
      ss: f.ss,
      s: f.s,
      belowS: f.belowS,
    })),
  };
}

/** 0~100 사이 정수 비율. 전체가 0이면 0. */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export interface NextGoal {
  /** 지금 SS 이상(EXC+FC+SS) 채보 수 */
  current: number;
  /** 다음 10곡 단위 목표 (전체를 넘지 않는다) */
  target: number;
  left: number;
}

/** 다음 목표 한 줄: SS 이상 개수를 다음 10곡 단위까지 올리기. 전체가 0이거나 이미 전부 SS 이상이면 null. */
export function nextGoal(p: Pick<ProgressSummary, "total" | "exc" | "fc" | "ss">): NextGoal | null {
  const current = p.exc + p.fc + p.ss;
  if (p.total <= 0 || current >= p.total) {
    return null;
  }
  const target = Math.min(p.total, Math.ceil((current + 1) / 10) * 10);
  return { current, target, left: target - current };
}

/** 기준 난이도가 없는 `미정` 묶음의 키. 레이팅 대상이 아니라서 `약함` 후보에서 뺀다. */
export const UNDECIDED_KEY = "undecided";

/**
 * 가장 비어 있는 구간(`약함`): 기록 비율이 가장 낮은 묶음. 비율이 같으면 기록 없는 채보가 더 많은 쪽.
 * 전체가 0인 묶음과 미정 묶음은 후보가 아니고, 비어 있는 채보가 하나도 없으면 null.
 */
export function weakestGroup(groups: readonly ProgressGroup[]): { group: ProgressGroup; empty: number } | null {
  let best: { group: ProgressGroup; empty: number; ratio: number } | null = null;
  for (const g of groups) {
    if (g.total <= 0 || g.key === UNDECIDED_KEY) {
      continue;
    }
    const empty = g.total - g.recorded;
    const ratio = g.recorded / g.total;
    if (best === null || ratio < best.ratio || (ratio === best.ratio && empty > best.empty)) {
      best = { group: g, empty, ratio };
    }
  }
  return best !== null && best.empty > 0 ? { group: best.group, empty: best.empty } : null;
}

/**
 * 칸 지도의 색 진하기(퍼센트). 많이 채울수록 배경(4→24%)과 테두리(18→63%)가 진해진다.
 * 색 값은 컴포넌트가 CSS 변수에 이 퍼센트만 섞어서 만든다.
 */
export function tileTint(recorded: number, total: number): { fill: number; line: number } {
  const ratio = total > 0 ? Math.min(1, recorded / total) : 0;
  return { fill: Math.round(4 + ratio * 20), line: Math.round(18 + ratio * 45) };
}
