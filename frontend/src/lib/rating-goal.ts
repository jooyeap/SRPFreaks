import { z } from "zod";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { requiredRate } from "@/lib/rating-target";
import { chartScore, DEFAULT_COEFFICIENTS } from "@/lib/rating-guide";

/**
 * 목표 레이팅 (편의 기능, DESIGN-UI 5장): 사용자가 정한 목표 합계에 닿으려면 내 레이팅 목록의 어떤 곡을 몇 %까지 올려야 하는지 계산한다.
 * 저장하는 값은 없고, 서버가 준 내 목록(점수·달성률·레이팅 상수 난이도)과 같은 식(chartScore)으로 화면에서만 계산한다.
 *
 * 왜 "목록 안의 곡만" 보는가: 이미 목록에 있는 곡은 점수가 오르기만 하므로 목록에서 밀려나지 않고, 합계는 늘어난 점수만큼 정확히 늘어난다.
 * 목록 밖의 곡을 새로 넣는 경우는 밀려나는 곡을 따져야 해서 계산이 복잡해져 이번 범위에서 뺐다(결과 화면에 그렇게 적는다).
 *
 * 현실적인 경로 (2026-10-19): 전에는 "곡 수가 가장 적게"를 우선해서 올릴 여지가 큰 곡을 95%까지 올렸다. 95%는 쉽지 않아서 이렇게 바꿨다.
 *  - 곡은 80 / 85 / 90 / 95% 구간 단위로 한 단계씩 올린다. 곡마다 "지금 달성률 바로 위 구간"이 첫 단계다.
 *  - 내 평균 난이도에 가장 가까운 난이도 폴더와 그 앞뒤 0.1 폴더(예: 5.4·5.5·5.6)의 곡만 먼저 쓴다. 이 폴더들만으로 모자라면 목록 전체로 넓힌다.
 *  - 한 단계씩 돌아가며(라운드) 올릴 폭이 작은 곡부터 고른다. 그래서 곡·폴더·구간이 골고루 섞인다.
 *  - 폴더 평균 달성률 바로 위 구간까지는 "현실적"이고, 그보다 높은 구간은 도전(challenge)으로 표시해 맨 뒤에 둔다.
 */
export const GOAL_STAGES = [80, 85, 90, 95] as const;

export interface GoalStep {
  entry: SkillEntryResponse;
  /** 지금 달성률 */
  fromRate: number;
  /** 이 곡을 여기까지 올리면 된다 (구간 값이거나, 마지막 곡이면 필요한 만큼만) */
  toRate: number;
  /** 이 곡이 더해 주는 점수 */
  gain: number;
  /** 이 곡이 속한 난이도 폴더의 평균 달성률보다 높은 구간까지 올려야 하면 true(도전) */
  challenge: boolean;
}

/** 평균 난이도 근처 폴더 한 줄: 난이도, 내 목록의 그 폴더 곡 수, 평균 달성률 */
export interface GoalFolder {
  tier: number;
  count: number;
  averageRate: number;
}

export interface GoalPlan {
  /** 목표 − 지금 합계 (항상 0 초과) */
  needed: number;
  steps: GoalStep[];
  /** 목록 안의 곡만으로 목표에 닿을 수 있는가. false이면 steps는 올릴 수 있는 모든 곡을 95%까지 올리는 경로다 */
  reachable: boolean;
  /** 쓸 수 있는 곡을 모두 95%까지 올렸을 때 늘어나는 점수 */
  maxGain: number;
  /** 닿지 못할 때 모자란 점수 (reachable이면 0) */
  shortfall: number;
  /** 평균 난이도 근처 폴더들(난이도 낮은 순). 목록이 비어 있으면 빈 배열 */
  folders: GoalFolder[];
  /** 근처 폴더만으로 모자라서 목록 전체로 넓혔으면 true */
  widened: boolean;
}

const EPS = 0.005;

/** 곡 하나를 한 구간 올리는 단위. 같은 곡의 앞 단계가 먼저 와야 한다(정렬 기준에 라운드가 있다). */
interface Increment {
  entry: SkillEntryResponse;
  tenths: number;
  stage: number;
  /** 이 단계만 올렸을 때 늘어나는 점수(바로 앞 단계 기준) */
  gain: number;
  /** 이 단계의 시작 점수(이 곡의 앞 단계까지 올렸을 때) */
  baseScore: number;
  /** 이 곡 안에서 몇 번째 단계인가(0부터). 라운드다 */
  round: number;
  /** 이 단계에서 올리는 달성률 폭 */
  rise: number;
  challenge: boolean;
  /** 곡이 속한 폴더가 근처 중심에서 몇 칸 떨어졌는가(같으면 가까운 폴더 먼저) */
  distance: number;
}

function allEntries(skill: SkillResponse): SkillEntryResponse[] {
  return [...skill.single, ...skill.other];
}

const tenthsOf = (tier: number) => Math.round(tier * 10);

/** 폴더(난이도)별 곡 수와 평균 달성률 */
function folderStats(entries: readonly SkillEntryResponse[]): Map<number, GoalFolder> {
  const sums = new Map<number, { count: number; sum: number }>();
  for (const e of entries) {
    const key = tenthsOf(e.tier);
    const cur = sums.get(key) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += e.achievementRate;
    sums.set(key, cur);
  }
  const result = new Map<number, GoalFolder>();
  for (const [key, { count, sum }] of sums) {
    result.set(key, { tier: key / 10, count, averageRate: sum / count });
  }
  return result;
}

/** 폴더 평균 달성률 이상인 가장 낮은 구간(평균이 80 아래면 80, 95를 넘으면 95). 이 구간까지가 "현실적"이다 */
function realisticStage(averageRate: number): number {
  return GOAL_STAGES.find((s) => s >= averageRate - EPS) ?? GOAL_STAGES[GOAL_STAGES.length - 1];
}

/** 곡 목록(entries)을 한 구간씩 올리는 단위들로 풀어 현실적인 순서로 정렬한다 */
function incrementsOf(entries: readonly SkillEntryResponse[], stats: Map<number, GoalFolder>, centerTenths: number): Increment[] {
  const result: Increment[] = [];
  for (const entry of entries) {
    if (entry.achievementRate >= DEFAULT_COEFFICIENTS.maxRate) {
      continue;
    }
    const tenths = tenthsOf(entry.tier);
    const folder = stats.get(tenths);
    const limit = realisticStage(folder ? folder.averageRate : entry.achievementRate);
    let prevScore = entry.score;
    let prevRate = entry.achievementRate;
    let round = 0;
    for (const stage of GOAL_STAGES) {
      if (stage <= prevRate + EPS) {
        continue;
      }
      const gain = chartScore(tenths, stage) - prevScore;
      if (gain > EPS) {
        result.push({
          entry, tenths, stage, gain, baseScore: prevScore, round, rise: stage - prevRate,
          challenge: stage > limit, distance: Math.abs(tenths - centerTenths),
        });
      }
      prevScore += Math.max(gain, 0);
      prevRate = stage;
      round += 1;
    }
  }
  // 현실적인 단계 먼저 → 라운드(한 단계씩 돌아가며) → 올릴 폭이 작은 것 → 중심에 가까운 폴더 → 점수 증가가 큰 것 순
  return result.sort(
    (a, b) =>
      Number(a.challenge) - Number(b.challenge) || a.round - b.round || a.rise - b.rise || a.distance - b.distance || b.gain - a.gain,
  );
}

interface Selected {
  steps: GoalStep[];
  reachable: boolean;
  remaining: number;
  maxGain: number;
}

/** 정렬된 단위를 앞에서부터 담아 목표를 채운다. 같은 곡의 여러 단계는 한 줄로 합친다 */
function select(incs: readonly Increment[], needed: number): Selected {
  const maxGain = incs.reduce((sum, i) => sum + i.gain, 0);
  const byChart = new Map<number, GoalStep>();
  let remaining = needed;

  for (const inc of incs) {
    if (remaining <= EPS) {
      break;
    }
    const partial = inc.gain + EPS >= remaining;
    // 마지막 단위는 남은 점수만큼만 올린다: 필요한 점수로 달성률을 거꾸로 구한다(소수 둘째 자리 올림). 못 구하면 구간 값으로 둔다
    const toRate = partial ? Math.min(requiredRate(inc.tenths, inc.baseScore + remaining) ?? inc.stage, inc.stage) : inc.stage;
    const gain = partial ? remaining : inc.gain;
    const existing = byChart.get(inc.entry.songDifficultyId);
    if (existing) {
      existing.toRate = toRate;
      existing.gain += gain;
      existing.challenge = existing.challenge || inc.challenge;
    } else {
      byChart.set(inc.entry.songDifficultyId, { entry: inc.entry, fromRate: inc.entry.achievementRate, toRate, gain, challenge: inc.challenge });
    }
    remaining -= gain;
  }
  // 처음 올리는 곡 순서(Map은 넣은 순서를 지킨다)대로 보여 준다
  return { steps: [...byChart.values()], reachable: remaining <= EPS, remaining: Math.max(remaining, 0), maxGain };
}

/**
 * 목표 합계에 닿는 경로를 만든다. 이미 목표 이상이면 null.
 * 1) 평균 난이도 근처 폴더의 곡으로 현실적인 순서의 경로를 만든다. 2) 모자라면 목록 전체로 넓혀 다시 만든다(widened).
 */
export function goalPlan(skill: SkillResponse, target: number): GoalPlan | null {
  const needed = target - skill.totalScore;
  if (!Number.isFinite(target) || needed <= EPS) {
    return null;
  }
  const entries = allEntries(skill);
  const stats = folderStats(entries);
  if (entries.length === 0) {
    return { needed, steps: [], reachable: false, maxGain: 0, shortfall: needed, folders: [], widened: false };
  }

  // 근처 폴더: 내 평균 난이도에 가장 가까운 (곡이 있는) 폴더 + 앞뒤 0.1
  const averageTier = entries.reduce((sum, e) => sum + e.tier, 0) / entries.length;
  const keys = [...stats.keys()];
  const center = keys.reduce((best, k) => (Math.abs(k / 10 - averageTier) < Math.abs(best / 10 - averageTier) - 1e-9 ? k : best), keys[0]);
  const near = entries.filter((e) => Math.abs(tenthsOf(e.tier) - center) <= 1);
  const folders = keys
    .filter((k) => Math.abs(k - center) <= 1)
    .sort((a, b) => a - b)
    .map((k) => stats.get(k) as GoalFolder);

  let result = select(incrementsOf(near, stats, center), needed);
  let widened = false;
  if (!result.reachable && near.length < entries.length) {
    result = select(incrementsOf(entries, stats, center), needed);
    widened = true;
  }
  return { needed, steps: result.steps, reachable: result.reachable, maxGain: result.maxGain, shortfall: result.remaining, folders, widened };
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
