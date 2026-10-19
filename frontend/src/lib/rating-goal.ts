import { z } from "zod";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { requiredRate } from "@/lib/rating-target";
import { chartScore, DEFAULT_COEFFICIENTS } from "@/lib/rating-guide";

/**
 * 목표 레이팅 (편의 기능, DESIGN-UI 5장): 사용자가 정한 목표 합계에 닿으려면 내 레이팅 목록의 어떤 곡을 몇 %까지 올려야 하는지 계산한다.
 * 저장하는 값은 없고, 서버가 준 내 목록(점수·달성률·레이팅 상수 난이도)과 같은 식(chartScore)으로 화면에서만 계산한다.
 *
 * 왜 "목록 안의 곡만" 보는가: 이미 목록에 있는 곡은 점수가 오르기만 하므로 목록에서 밀려나지 않고, 합계는 늘어난 점수만큼 정확히 늘어난다.
 * 목록 밖의 곡을 새로 넣는 경우는 밀려나는 곡을 따져야 해서 계산이 복잡해지고 설명도 어려워, 이번 범위에서 뺐다(결과 화면에 그렇게 적는다).
 * 곡마다 올릴 수 있는 한계는 95%다(점수가 95%에서 최대가 되므로).
 */
export interface GoalStep {
  entry: SkillEntryResponse;
  /** 지금 달성률 */
  fromRate: number;
  /** 이 곡을 여기까지 올리면 된다 (95%이면 끝까지, 그보다 낮으면 마지막 곡이라 필요한 만큼만) */
  toRate: number;
  /** 이 곡이 더해 주는 점수 */
  gain: number;
}

export interface GoalPlan {
  /** 목표 − 지금 합계 (항상 0 초과) */
  needed: number;
  steps: GoalStep[];
  /** 목록 안의 곡만으로 목표에 닿을 수 있는가. false이면 steps는 올릴 수 있는 모든 곡을 95%까지 올리는 경로다 */
  reachable: boolean;
  /** 목록 안의 곡을 모두 95%까지 올렸을 때 늘어나는 점수 */
  maxGain: number;
  /** 닿지 못할 때 모자란 점수 (reachable이면 0) */
  shortfall: number;
}

const EPS = 0.005;

interface Candidate {
  entry: SkillEntryResponse;
  tenths: number;
  gain: number;
}

function candidatesOf(skill: SkillResponse): Candidate[] {
  const result: Candidate[] = [];
  for (const entry of [...skill.single, ...skill.other]) {
    if (entry.achievementRate >= DEFAULT_COEFFICIENTS.maxRate) {
      continue;
    }
    const tenths = Math.round(entry.tier * 10);
    const gain = chartScore(tenths, DEFAULT_COEFFICIENTS.maxRate) - entry.score;
    if (gain > EPS) {
      result.push({ entry, tenths, gain });
    }
  }
  return result;
}

/**
 * 목표 합계에 닿는 가장 짧은 경로(올릴 곡 수가 가장 적은 경로)를 고른다. 이미 목표 이상이면 null.
 * 방법: 남은 점수를 한 곡으로 채울 수 있으면 "그걸 채울 수 있는 곡 중 점수 증가 여지가 가장 작은 곡"을 필요한 만큼만 올리고 끝낸다(곡을 아낀다).
 * 한 곡으로 모자라면 여지가 가장 큰 곡을 95%까지 올리고, 남은 점수로 같은 판단을 반복한다.
 */
export function goalPlan(skill: SkillResponse, target: number): GoalPlan | null {
  const needed = target - skill.totalScore;
  if (!Number.isFinite(target) || needed <= EPS) {
    return null;
  }
  const rest = candidatesOf(skill).sort((a, b) => b.gain - a.gain); // 여지가 큰 순. 같으면 목록 순서가 유지된다(정렬은 안정적)
  const maxGain = rest.reduce((sum, c) => sum + c.gain, 0);
  const steps: GoalStep[] = [];
  let remaining = needed;

  while (remaining > EPS && rest.length > 0) {
    if (rest[0].gain + EPS >= remaining) {
      // 한 곡으로 채울 수 있다: 그중 여지가 가장 작은 곡을 고른다(rest는 내림차순이라 뒤에서부터 찾는다)
      let index = 0;
      for (let i = rest.length - 1; i >= 0; i--) {
        if (rest[i].gain + EPS >= remaining) {
          index = i;
          break;
        }
      }
      const [c] = rest.splice(index, 1);
      // 필요한 점수로 달성률을 거꾸로 구한다(소수 둘째 자리 올림). 못 구하면(null) 95%까지로 둔다
      const toRate = requiredRate(c.tenths, c.entry.score + remaining) ?? DEFAULT_COEFFICIENTS.maxRate;
      steps.push({ entry: c.entry, fromRate: c.entry.achievementRate, toRate, gain: remaining });
      remaining = 0;
    } else {
      const [c] = rest.splice(0, 1);
      steps.push({ entry: c.entry, fromRate: c.entry.achievementRate, toRate: DEFAULT_COEFFICIENTS.maxRate, gain: c.gain });
      remaining -= c.gain;
    }
  }

  const reachable = remaining <= EPS;
  return { needed, steps, reachable, maxGain, shortfall: reachable ? 0 : remaining };
}

/**
 * 목표 입력 폼 검사 (React Hook Form + Zod). 입력은 글자로 받아 형식을 먼저 본다: 정수 최대 5자리, 소수는 둘째 자리까지.
 * "지금 레이팅보다 높은가"는 폼이 아니라 결과 화면에서 알려 준다(레이팅은 서버 값이라 폼 검사에 섞지 않는다).
 */
export const goalFormSchema = z.object({
  target: z
    .string()
    .trim()
    .min(1, "목표 레이팅을 입력해 주세요.")
    .regex(/^\d{1,5}(\.\d{1,2})?$/, "숫자로 입력해 주세요. 소수는 둘째 자리까지 입력할 수 있습니다.")
    .refine((value) => Number(value) > 0, "0보다 큰 값을 입력해 주세요."),
});

export type GoalFormValues = z.infer<typeof goalFormSchema>;
