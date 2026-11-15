import { useSyncExternalStore } from "react";
import type { TierGroupResponse } from "@/lib/api-types";
import { EMPTY_FILTERS, filterTierGroup } from "@/lib/difficulty-table";

/**
 * 홈 진행도 카드의 속성 필터(D85). `all`은 전체, 나머지는 서버가 쓰는 속성 값 그대로다(서열표 pattern 필터·곡 목록 chart-folders의 pattern과 같다).
 * 속성이 없는 채보(레이팅 제외·NULL·서열표에 없음)와 복합(단일)은 어느 속성 칩에도 들어가지 않고 `all`에만 포함된다.
 */
export const PROGRESS_PATTERNS = ["all", "단일", "복합", "이중", "삼중"] as const;
export type ProgressPattern = (typeof PROGRESS_PATTERNS)[number];

/** 속성별 채보 수(칩 숫자). all은 그 탭의 전체 채보 수다. */
export type PatternCounts = Record<ProgressPattern, number>;

/** 저장된 값(믿을 수 없는 문자열)을 화이트리스트로 걸러 속성 값으로 바꾼다. 모르는 값은 전체. */
export function parseProgressPattern(raw: unknown): ProgressPattern {
  return PROGRESS_PATTERNS.find((p) => p === raw) ?? "all";
}

/** 서버에 보낼 속성 값. 전체는 파라미터를 보내지 않는다(null). */
export function patternParam(pattern: ProgressPattern): string | null {
  return pattern === "all" ? null : pattern;
}

/** 서열표 탭의 칩 숫자: 묶음에 담긴 채보의 속성으로 센다. 전체는 묶음 합계(g.total)다. */
export function patternCountsOfGroups(groups: readonly TierGroupResponse[]): PatternCounts {
  const counts: PatternCounts = { all: 0, 단일: 0, 복합: 0, 이중: 0, 삼중: 0 };
  for (const g of groups) {
    counts.all += g.total;
    for (const e of g.entries) {
      const key = parseProgressPattern(e.pattern);
      if (key !== "all") {
        counts[key] += 1;
      }
    }
  }
  return counts;
}

/** 곡 목록 탭의 칩 숫자: 서버가 준 속성별 개수 + 전체 채보 수(속성 필터를 걸지 않은 응답 기준). */
export function patternCountsFromServer(totalCharts: number, byPattern: Readonly<Record<string, number>> | undefined): PatternCounts {
  const pick = (key: string) => byPattern?.[key] ?? 0;
  return { all: totalCharts, 단일: pick("단일"), 복합: pick("복합"), 이중: pick("이중"), 삼중: pick("삼중") };
}

/**
 * 서열표 묶음을 속성으로 다시 센다(링·표·난이도 행이 모두 이 결과로 만들어진다). 전체면 그대로.
 * 고른 속성의 채보가 하나도 없는 난이도 행(묶음)은 뺀다. 개수는 서버가 채보마다 준 mine.stage로 센다(filterTierGroup).
 */
export function groupsForPattern(groups: readonly TierGroupResponse[], pattern: ProgressPattern): TierGroupResponse[] {
  if (pattern === "all") {
    return [...groups];
  }
  return groups.map((g) => filterTierGroup(g, { ...EMPTY_FILTERS, pattern: [pattern] })).filter((g) => g.total > 0);
}

// ---- 기기별 기억 -----------------------------------------------------------------------------
// localStorage에는 속성 값(단일 등) 하나만 넣는다. 토큰·개인정보는 저장하지 않는다. 저장소를 못 쓰는 환경(사생활 보호 창 등)에서도
// 이번 화면에서는 메모리 값으로 동작한다. 서버 렌더링 값은 항상 전체라서 화면이 처음에는 전체였다가 저장된 값으로 바뀔 수 있다.
export const PROGRESS_PATTERN_KEY = "srp.homeProgressPattern";

let current: ProgressPattern | null = null;
const listeners = new Set<() => void>();

function read(): ProgressPattern {
  if (current === null) {
    try {
      current = parseProgressPattern(localStorage.getItem(PROGRESS_PATTERN_KEY));
    } catch {
      current = "all";
    }
  }
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setProgressPattern(pattern: ProgressPattern): void {
  current = pattern;
  try {
    localStorage.setItem(PROGRESS_PATTERN_KEY, pattern);
  } catch {
    // 저장할 수 없어도 이번 화면에서는 바뀐다
  }
  listeners.forEach((listener) => listener());
}

/** 테스트용: 메모리 값을 비워서 다음 읽기에서 저장소를 다시 본다 */
export function resetProgressPatternForTest(): void {
  current = null;
  listeners.forEach((listener) => listener());
}

export function useProgressPattern(): ProgressPattern {
  return useSyncExternalStore(subscribe, read, () => "all");
}
