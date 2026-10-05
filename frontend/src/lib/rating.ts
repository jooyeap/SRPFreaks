import { apiFetch } from "@/lib/api";
import type { PlayerTierResponse, SkillResponse } from "@/lib/api-types";

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
