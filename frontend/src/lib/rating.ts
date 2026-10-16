import { apiFetch } from "@/lib/api";
import type { PlayerTierResponse, SkillEntryResponse, SkillResponse } from "@/lib/api-types";

/**
 * 레이팅 쿼리 키. 사용자 id를 넣어 계정이 바뀌어도 이전 사용자의 캐시를 보지 않게 한다.
 * 앞부분 "skill"은 records.ts의 AFFECTED_QUERY_KEYS와 같다: 기록을 저장/수정/삭제하면 이 키들이 무효화된다.
 */
export const skillKeys = {
  me: (userId: number) => ["skill", userId] as const,
};

export function fetchMySkill(signal?: AbortSignal): Promise<SkillResponse> {
  return apiFetch<SkillResponse>("/skills/me", { signal });
}

export interface TierProgress {
  /** 현재 티어 구간 안에서 얼마나 왔는지 (0 ~ 1) */
  ratio: number;
  /** 다음 티어까지 남은 점수 (0 이상) */
  remaining: number;
  nextDisplayName: string;
}

/**
 * 다음 티어까지의 진행도. 마지막 티어(더 올라갈 구간이 없음)면 null이고 화면에는 `최고 티어`를 쓴다.
 *
 * 서버가 내리는 합계(totalScore)는 소수 둘째 자리로 반올림된 값이고, 티어는 반올림 전 합계의 정수부로 정한다(D20).
 * 그래서 아주 드물게 합계가 구간 경계 바로 아래/위로 0.01 어긋나 보일 수 있다. 막대가 구간 밖으로 나가거나
 * 남은 점수가 음수로 보이지 않도록 값을 범위 안으로 맞춘다.
 */
export function tierProgress(totalScore: number, tier: PlayerTierResponse): TierProgress | null {
  if (tier.nextMinScore === null || tier.nextDisplayName === null) {
    return null;
  }
  const span = tier.nextMinScore - tier.minScore;
  const ratio = span > 0 ? (totalScore - tier.minScore) / span : 0;
  return {
    ratio: Math.min(Math.max(ratio, 0), 1),
    remaining: Math.max(tier.nextMinScore - totalScore, 0),
    nextDisplayName: tier.nextDisplayName,
  };
}

/** "곧 빠질 곡"으로 보는 범위: 구역 맨 아래 곡과의 점수 차이(점)와 구역마다 보여 줄 최대 곡 수 */
export const AT_RISK_MARGIN = 2;
export const AT_RISK_MAX = 3;

/**
 * 곧 빠질 곡 = 구역(단일 / 복합·이중·삼중)이 꽉 찼을 때 맨 아래 곡과 점수 차이가 AT_RISK_MARGIN 이하인 곡(최대 AT_RISK_MAX곡).
 * 꽉 찬 구역에 더 높은 점수의 곡이 들어오면 맨 아래 곡부터 밀려나고, 아래 곡들끼리는 점수가 비슷해서 쉽게 순서가 바뀐다.
 * 구역이 덜 찼으면 밀려날 곡이 없으므로 빈 목록이다. entries는 서버가 준 순위(점수 높은 순) 그대로여야 한다.
 */
export function atRiskEntries(entries: readonly SkillEntryResponse[], limit: number): SkillEntryResponse[] {
  if (entries.length === 0 || entries.length < limit) {
    return [];
  }
  const lastScore = entries[entries.length - 1].score;
  return entries.filter((e) => e.score - lastScore <= AT_RISK_MARGIN).slice(-AT_RISK_MAX);
}

export interface GoalHint {
  nextDisplayName: string;
  /** 다음 티어까지 남은 점수 */
  remaining: number;
  /** 곡 하나만 바꿔서 다음 티어에 가려면 그 곡이 가져야 할 점수 */
  needScore: number;
  /** 어느 구역에서 바꾸는 게 가장 쉬운가 */
  groupName: "단일" | "복합·이중·삼중";
  /** 그 구역이 꽉 찼을 때 밀려나는 맨 아래 곡의 점수. 구역이 덜 찼으면 null(곡이 그냥 추가된다) */
  replacedScore: number | null;
}

/**
 * 레이팅 목표 안내: 곡 하나만 올려서 다음 티어에 가려면 어느 구역에서 몇 점짜리 곡이 필요한가.
 * 꽉 찬 구역은 맨 아래 곡이 밀려나므로 (밀려나는 점수 + 남은 점수), 덜 찬 구역은 곡이 그냥 추가되므로 남은 점수만 필요하다.
 * 두 구역 중 필요한 점수가 더 작은 쪽을 고른다. 최고 티어이면 null.
 */
export function goalHint(skill: SkillResponse): GoalHint | null {
  const progress = tierProgress(skill.totalScore, skill.tier);
  if (progress === null) {
    return null;
  }
  const groups = [
    { groupName: "단일" as const, entries: skill.single, limit: skill.singleLimit },
    { groupName: "복합·이중·삼중" as const, entries: skill.other, limit: skill.otherLimit },
  ].map(({ groupName, entries, limit }) => {
    const full = limit > 0 && entries.length >= limit;
    const replacedScore = full ? entries[entries.length - 1].score : null;
    return { groupName, replacedScore, needScore: (replacedScore ?? 0) + progress.remaining };
  });
  const best = groups.reduce((a, b) => (b.needScore < a.needScore ? b : a));
  return { nextDisplayName: progress.nextDisplayName, remaining: progress.remaining, ...best };
}
