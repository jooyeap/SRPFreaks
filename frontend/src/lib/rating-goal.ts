import { z } from "zod";
import type { Translator } from "@/i18n/translator";
import type { SkillEntryResponse, SkillResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import type { DifficultyType, InstrumentPart } from "@/lib/types";
import { requiredRate } from "@/lib/rating-target";
import { chartScore, DEFAULT_COEFFICIENTS } from "@/lib/rating-guide";

/**
 * 목표 레이팅 (편의 기능, DESIGN-UI 5장): 사용자가 정한 목표 합계에 닿으려면 내 레이팅 목록의 어떤 곡을 몇 %까지 올려야 하는지 계산한다.
 * 저장하는 값은 없고, 서버가 준 내 목록(점수·달성률·레이팅 상수 난이도)과 같은 식(chartScore)으로 화면에서만 계산한다.
 *
 * 목록 밖의 곡 (2026-10-19): 서열표(`pool`)에 있는 목록 밖 채보도 후보다. 올린 점수가 단일 15 / 그 외 25 목록의 맨 아래 점수보다 높으면
 * 그 채보가 목록에 들어가고 맨 아래 곡이 밀려난다. 그래서 곡마다 "목록 합계가 실제로 얼마나 늘어나는가"(밀려나는 곡을 뺀 증가분)를 계산한다.
 * 목록은 항상 "그룹 안의 점수 상위 limit개"라서, 최종 목록은 곡별 최종 점수만으로 정해진다(올리는 순서와 무관).
 *
 * 현실적인 경로 (2026-10-19): 전에는 "곡 수가 가장 적게"를 우선해서 올릴 여지가 큰 곡을 95%까지 올렸다. 95%는 쉽지 않아서 이렇게 바꿨다.
 *  - 곡은 80 / 85 / 90 / 95% 구간 단위로 한 단계씩 올린다. 곡마다 "지금 달성률 바로 위 구간"이 첫 단계다.
 *  - 내 평균 난이도에 가장 가까운 난이도 폴더와 그 앞뒤 0.1 폴더(예: 5.4·5.5·5.6)의 곡만 먼저 쓴다. 이 폴더들만으로 모자라면 목록 전체로 넓힌다.
 *  - 한 단계씩 돌아가며(라운드) 올릴 폭이 작은 곡부터 고른다. 그래서 곡·폴더·구간이 골고루 섞인다.
 *  - 폴더 평균 달성률 바로 위 구간까지는 "현실적"이고, 그보다 높은 구간은 도전(challenge)으로 표시해 맨 뒤에 둔다.
 */
export const GOAL_STAGES = [80, 85, 90, 95] as const;

/** 경로에 나오는 채보 한 곡의 표시 정보(내 레이팅 목록 항목과 서열표 항목 둘 다에서 만든다) */
export interface GoalChart {
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  /** 서열표 기준 난이도 */
  tier: number;
}

export interface GoalStep {
  entry: GoalChart;
  /** 지금 달성률. 기록이 없으면 null */
  fromRate: number | null;
  /** 이 곡을 여기까지 올리면 된다 (구간 값이거나, 마지막 곡이면 필요한 만큼만) */
  toRate: number;
  /** 이 곡 덕분에 늘어나는 목록 합계. 목록에 새로 들어오는 곡이면 밀려나는 곡의 점수를 뺀 값이다 */
  gain: number;
  /** 이 곡이 속한 난이도 폴더의 평균 달성률보다 높은 구간까지 올려야 하면 true(도전) */
  challenge: boolean;
  /** 지금은 목록 밖이고 이 달성률이 되면 목록에 새로 들어오는 곡이면 true */
  entering: boolean;
}

/** 목록에서 밀려나는 곡 */
export interface GoalDisplaced {
  entry: GoalChart;
  rate: number;
  score: number;
}

/** 평균 난이도 근처 폴더 한 줄: 난이도, 그 폴더에서 기록이 있는 곡 수, 평균 달성률 */
export interface GoalFolder {
  tier: number;
  count: number;
  averageRate: number;
}

export interface GoalPlan {
  /** 목표 − 지금 합계 (항상 0 초과) */
  needed: number;
  steps: GoalStep[];
  /** 쓸 수 있는 곡만으로 목표에 닿을 수 있는가. false이면 steps는 올릴 수 있는 모든 곡을 95%까지 올리는 경로다 */
  reachable: boolean;
  /** 닿지 못할 때(reachable=false): 쓸 수 있는 곡을 모두 95%까지 올렸을 때 늘어나는 점수 */
  maxGain: number;
  /** 닿지 못할 때 모자란 점수 (reachable이면 0) */
  shortfall: number;
  /** 평균 난이도 근처 폴더들(난이도 낮은 순). 목록이 비어 있으면 빈 배열 */
  folders: GoalFolder[];
  /** 근처 폴더만으로 모자라서 전체 폴더로 넓혔으면 true */
  widened: boolean;
  /** 이 경로를 따라가면 목록에서 밀려나는 곡들 */
  displaced: GoalDisplaced[];
}

const EPS = 0.005;
type Kind = "single" | "other";

/** 목록 종류별로 해당하는 속성. 단일 목록에는 단일 채보만, 그 외 목록에는 복합·이중·삼중 채보만 들어간다. */
const PATTERN_KIND: Record<string, Kind> = { 단일: "single", 복합: "other", 이중: "other", 삼중: "other" };

/** 계산에 쓰는 채보 한 곡. member = 지금 내 레이팅 목록 안에 있는가 */
interface Chart {
  chart: GoalChart;
  tenths: number;
  kind: Kind;
  /** 기록이 없으면 null (점수 0으로 본다) */
  rate: number | null;
  score: number;
  member: boolean;
}

/** 곡 하나를 한 구간 올리는 단위. 같은 곡의 앞 단계가 먼저 와야 한다(정렬 기준에 라운드가 있다). */
interface Increment {
  chart: Chart;
  stage: number;
  /** 이 곡 안에서 몇 번째 단계인가(0부터). 라운드다 */
  round: number;
  /** 이 단계에서 올리는 달성률 폭 */
  rise: number;
  /** 이 곡 점수가 이 단계에서 늘어나는 양(정렬 동점 처리용) */
  gain: number;
  challenge: boolean;
  /** 곡이 속한 폴더가 근처 중심에서 몇 칸 떨어졌는가(같으면 가까운 폴더 먼저) */
  distance: number;
}

const tenthsOf = (tier: number) => Math.round(tier * 10);

function toGoalChart(e: Pick<SkillEntryResponse, "songDifficultyId" | "songId" | "title" | "part" | "difficulty" | "level">, tier: number): GoalChart {
  return { songDifficultyId: e.songDifficultyId, songId: e.songId, title: e.title, part: e.part, difficulty: e.difficulty, level: e.level, tier };
}

/** 내 레이팅 목록 항목 + (있으면) 서열표의 목록 밖 항목으로 계산용 채보 목록을 만든다. 목록 안 항목은 서버 값이 기준이다. */
function buildCharts(skill: SkillResponse, groups: readonly TierGroupResponse[] | undefined): Chart[] {
  const charts = new Map<number, Chart>();
  const add = (kind: Kind, e: SkillEntryResponse) => {
    charts.set(e.songDifficultyId, { chart: toGoalChart(e, e.tier), tenths: tenthsOf(e.tier), kind, rate: e.achievementRate, score: e.score, member: true });
  };
  skill.single.forEach((e) => add("single", e));
  skill.other.forEach((e) => add("other", e));
  for (const group of groups ?? []) {
    if (group.tier === null) {
      continue;
    }
    const tenths = tenthsOf(group.tier);
    for (const e of group.entries as TableEntryResponse[]) {
      const kind = e.pattern === null ? undefined : PATTERN_KIND[e.pattern];
      // 레이팅 대상 = 반영이 켜져 있고 속성이 있는 채보. 이미 목록에 있는 채보는 위에서 넣었다
      if (!e.ratingEnabled || kind === undefined || charts.has(e.songDifficultyId)) {
        continue;
      }
      const rate = e.mine ? e.mine.rate : null;
      charts.set(e.songDifficultyId, {
        chart: toGoalChart(e, group.tier), tenths, kind, rate, score: rate === null ? 0 : chartScore(tenths, rate), member: false,
      });
    }
  }
  return [...charts.values()];
}

/** 폴더(난이도)별로 기록이 있는 곡의 수와 평균 달성률 */
function folderStats(charts: readonly Chart[]): Map<number, GoalFolder> {
  const sums = new Map<number, { count: number; sum: number }>();
  for (const c of charts) {
    if (c.rate === null) {
      continue;
    }
    const cur = sums.get(c.tenths) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += c.rate;
    sums.set(c.tenths, cur);
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

/** 채보들을 한 구간씩 올리는 단위들로 풀어 현실적인 순서로 정렬한다 */
function incrementsOf(charts: readonly Chart[], stats: Map<number, GoalFolder>, centerTenths: number): Increment[] {
  const result: Increment[] = [];
  for (const chart of charts) {
    const startRate = chart.rate ?? 0;
    if (startRate >= DEFAULT_COEFFICIENTS.maxRate) {
      continue;
    }
    const folder = stats.get(chart.tenths);
    const limit = realisticStage(folder ? folder.averageRate : 0);
    let prevScore = chart.score;
    let prevRate = startRate;
    let round = 0;
    for (const stage of GOAL_STAGES) {
      if (stage <= prevRate + EPS) {
        continue;
      }
      const gain = chartScore(chart.tenths, stage) - prevScore;
      if (gain > EPS) {
        result.push({ chart, stage, round, rise: stage - prevRate, gain, challenge: stage > limit, distance: Math.abs(chart.tenths - centerTenths) });
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

/**
 * 내 레이팅 목록의 현재 상태: 그룹(단일 / 그 외)마다 점수 상위 limit개(id → 점수).
 * 목록 밖 채보의 점수가 맨 아래 점수보다 높아지면 그 채보가 들어가고 맨 아래 곡이 밀려난다.
 */
class ListState {
  private readonly members: Record<Kind, Map<number, number>> = { single: new Map(), other: new Map() };

  constructor(
    private readonly limits: Record<Kind, number>,
    charts: readonly Chart[],
  ) {
    for (const c of charts) {
      if (c.member) {
        this.members[c.kind].set(c.chart.songDifficultyId, c.score);
      }
    }
  }

  clone(): ListState {
    const copy = new ListState(this.limits, []);
    for (const kind of ["single", "other"] as const) {
      this.members[kind].forEach((score, id) => copy.members[kind].set(id, score));
    }
    return copy;
  }

  has(kind: Kind, id: number): boolean {
    return this.members[kind].has(id);
  }

  /** 목록 밖 채보가 들어오려면 넘어야 하는 점수. 목록이 아직 차지 않았으면 0 */
  private cutoff(kind: Kind): { score: number; id: number | null } {
    const map = this.members[kind];
    if (map.size < this.limits[kind]) {
      return { score: 0, id: null };
    }
    let minId: number | null = null;
    let min = Infinity;
    map.forEach((score, id) => {
      if (score < min) {
        min = score;
        minId = id;
      }
    });
    return { score: min, id: minId };
  }

  /** 이 채보의 점수를 newScore로 올리면 목록 합계가 얼마나 늘어나는가(밀려나는 곡을 뺀 값) */
  marginal(kind: Kind, id: number, newScore: number): number {
    const own = this.members[kind].get(id);
    if (own !== undefined) {
      return Math.max(newScore - own, 0);
    }
    return Math.max(newScore - this.cutoff(kind).score, 0);
  }

  /** marginal이 0보다 크게 되려는 "지금 기준 점수": 목록 안이면 자기 점수, 밖이면 들어오기 위해 넘어야 하는 점수 */
  baseline(kind: Kind, id: number): number {
    return this.members[kind].get(id) ?? this.cutoff(kind).score;
  }

  apply(kind: Kind, id: number, newScore: number): void {
    const map = this.members[kind];
    if (map.has(id)) {
      map.set(id, Math.max(newScore, map.get(id) as number));
      return;
    }
    const cut = this.cutoff(kind);
    if (newScore > cut.score) {
      if (cut.id !== null) {
        map.delete(cut.id);
      }
      map.set(id, newScore);
    }
  }
}

interface Run {
  /** 곡별 최종 계획(처음 건드린 순서). 달성률과 점수 */
  planned: Map<number, { rate: number; score: number }>;
  reachable: boolean;
  remaining: number;
  gained: number;
  state: ListState;
}

/** 정렬된 단위를 앞에서부터 올려 가며 목표를 채운다. 목록 합계가 실제로 늘어난 만큼(밀려나는 곡 제외)만 센다 */
function runIncrements(incs: readonly Increment[], limits: Record<Kind, number>, all: readonly Chart[], needed: number): Run {
  const state = new ListState(limits, all);
  const planned = new Map<number, { rate: number; score: number }>();
  let remaining = needed;
  let gained = 0;

  for (const inc of incs) {
    if (remaining <= EPS) {
      break;
    }
    const { chart } = inc;
    const id = chart.chart.songDifficultyId;
    const current = planned.get(id)?.score ?? chart.score;
    let toRate: number = inc.stage;
    let newScore = chartScore(chart.tenths, inc.stage);
    if (newScore <= current + EPS) {
      continue;
    }
    let marginal = state.marginal(chart.kind, id, newScore);
    if (marginal > EPS && marginal + EPS >= remaining) {
      // 마지막 단위는 남은 점수만큼만 올린다: 필요한 점수로 달성률을 거꾸로 구한다(소수 둘째 자리 올림). 못 구하면 구간 값으로 둔다
      const target = state.baseline(chart.kind, id) + remaining;
      toRate = Math.min(requiredRate(chart.tenths, target) ?? inc.stage, inc.stage);
      // 한 번도 치지 않은 채보에게 "3%까지만"처럼 어색한 목표를 주지 않도록, 기록이 없던 곡은 첫 구간(80%)부터 시작한다
      if (chart.rate === null) {
        toRate = Math.max(toRate, GOAL_STAGES[0]);
      }
      newScore = chartScore(chart.tenths, toRate);
      marginal = state.marginal(chart.kind, id, newScore);
    }
    state.apply(chart.kind, id, newScore);
    planned.set(id, { rate: toRate, score: newScore });
    gained += marginal;
    remaining -= marginal;
  }
  return { planned, reachable: remaining <= EPS, remaining: Math.max(remaining, 0), gained, state };
}

/**
 * 목표 합계에 닿는 경로를 만든다. 이미 목표 이상이면 null.
 * @param pool 서열표 묶음(목록 밖 채보와 내 기록). 없으면 내 레이팅 목록 안의 곡만으로 계산한다.
 * 1) 평균 난이도 근처 폴더의 곡으로 현실적인 순서의 경로를 만든다. 2) 모자라면 전체 폴더로 넓혀 다시 만든다(widened).
 */
export function goalPlan(skill: SkillResponse, target: number, pool?: readonly TierGroupResponse[]): GoalPlan | null {
  const needed = target - skill.totalScore;
  if (!Number.isFinite(target) || needed <= EPS) {
    return null;
  }
  const charts = buildCharts(skill, pool);
  const stats = folderStats(charts);
  const listEntries = [...skill.single, ...skill.other];
  if (charts.length === 0) {
    return { needed, steps: [], reachable: false, maxGain: 0, shortfall: needed, folders: [], widened: false, displaced: [] };
  }

  // 근처 폴더: 내 레이팅 목록의 평균 난이도에 가장 가까운 (곡이 있는) 폴더 + 앞뒤 0.1
  const averageTier = listEntries.length > 0 ? listEntries.reduce((sum, e) => sum + e.tier, 0) / listEntries.length : null;
  const tenthsKeys = [...new Set(charts.map((c) => c.tenths))];
  const centerKey = tenthsKeys.reduce(
    (best, k) => (averageTier === null || Math.abs(k / 10 - averageTier) < Math.abs(best / 10 - averageTier) - 1e-9 ? k : best),
    tenthsKeys[0],
  );
  const near = charts.filter((c) => Math.abs(c.tenths - centerKey) <= 1);
  const folders = [...stats.keys()]
    .filter((k) => Math.abs(k - centerKey) <= 1)
    .sort((a, b) => a - b)
    .map((k) => stats.get(k) as GoalFolder);

  const limits: Record<Kind, number> = { single: skill.singleLimit, other: skill.otherLimit };
  let run = runIncrements(incrementsOf(near, stats, centerKey), limits, charts, needed);
  let widened = false;
  if (!run.reachable && near.length < charts.length) {
    run = runIncrements(incrementsOf(charts, stats, centerKey), limits, charts, needed);
    widened = true;
  }

  // 곡별 최종 점수로 결과를 만든다: 최종 목록에 남는 곡만 경로에 넣고, 곡마다 늘어나는 점수는 처음 건드린 순서대로 다시 센다
  const byId = new Map(charts.map((c) => [c.chart.songDifficultyId, c]));
  const replay = new ListState(limits, charts);
  const steps: GoalStep[] = [];
  for (const [id, plan] of run.planned) {
    const c = byId.get(id) as Chart;
    if (!run.state.has(c.kind, id)) {
      continue; // 목록에 들어오지 못했거나 들어왔다가 다른 곡에 밀려난 곡
    }
    const gain = replay.marginal(c.kind, id, plan.score);
    const entering = !c.member;
    replay.apply(c.kind, id, plan.score);
    if (gain <= EPS) {
      continue;
    }
    const folder = stats.get(c.tenths);
    steps.push({
      entry: c.chart,
      fromRate: c.rate,
      toRate: plan.rate,
      gain,
      challenge: plan.rate > realisticStage(folder ? folder.averageRate : 0) + EPS,
      entering,
    });
  }
  const displaced: GoalDisplaced[] = charts
    .filter((c) => c.member && !run.state.has(c.kind, c.chart.songDifficultyId))
    .map((c) => ({ entry: c.chart, rate: c.rate ?? 0, score: c.score }));

  return {
    needed, steps, reachable: run.reachable, maxGain: run.gained, shortfall: run.remaining, folders, widened, displaced,
  };
}

/**
 * 목표 입력 폼 검사 (React Hook Form + Zod). 입력은 글자로 받아 형식을 먼저 본다: 정수 최대 5자리, 소수는 둘째 자리까지.
 * "지금 레이팅보다 높은가"는 폼이 아니라 결과 화면에서 알려 준다(레이팅은 서버 값이라 폼 검사에 섞지 않는다).
 */
export function makeGoalFormSchema(t: Translator) {
  return z.object({
    target: z
      .string()
      .trim()
      .min(1, t("Validation.goalRequired"))
      .regex(/^\d{1,5}(\.\d{1,2})?$/, t("Validation.goalFormat"))
      .refine((value) => Number(value) > 0, t("Validation.goalPositive")),
  });
}

export type GoalFormValues = z.infer<ReturnType<typeof makeGoalFormSchema>>;
