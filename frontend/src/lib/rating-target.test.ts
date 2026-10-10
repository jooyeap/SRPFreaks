import { describe, expect, it } from "vitest";
import type { SkillEntryResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { chartScore } from "@/lib/rating-guide";
import { planRows, planTargets, requiredRate } from "@/lib/rating-target";

describe("requiredRate (점수 → 필요 달성률)", () => {
  it("가산 구간 아래: 7.0(R=20)에서 160점은 V=8 → 40%", () => {
    expect(requiredRate(70, 160)).toBe(40);
  });

  it("가산 구간: 6.0(R=15)에서 240점은 정확히 80%", () => {
    // V = 12 = 15×0.8 → 경계는 아래 식으로 80%
    expect(requiredRate(60, 240)).toBe(80);
  });

  it("직접 계산한 예: 6.0에서 90%의 점수(V=12+3.2×10/15)는 다시 90%가 되고, 조금만 넘으면 90.01%가 된다", () => {
    const exact = (12 + (3.2 * 10) / 15) * 20; // 282.6666…
    expect(requiredRate(60, exact)).toBe(90);
    expect(requiredRate(60, 282.667)).toBe(90.01); // 올림이라 모자라지 않게 한 칸 위
  });

  it("되돌려 계산하면 원래 점수 이상이 나온다 (올림이므로 모자라지 않는다)", () => {
    for (const tenths of [50, 55, 60, 65, 70]) {
      for (const score of [10, 55.5, 100, 150.25, 216, 280]) {
        const rate = requiredRate(tenths, score);
        if (rate !== null) {
          expect(chartScore(tenths, rate)).toBeGreaterThanOrEqual(score - 1e-6);
          // 0.01% 낮추면 모자라야 한다 (최소값이라는 뜻)
          if (rate > 0.01 && rate < 95) {
            expect(chartScore(tenths, rate - 0.01)).toBeLessThan(score);
          }
        }
      }
    }
  });

  it("그 난이도의 95% 점수를 넘으면 null (불가능)", () => {
    // 6.0의 최고 점수 = 304, 7.0은 384
    expect(requiredRate(60, 304)).toBe(95);
    expect(requiredRate(60, 304.01)).toBeNull();
    expect(requiredRate(70, 384)).toBe(95);
  });

  it("0점 이하는 0%, 이상한 값은 null", () => {
    expect(requiredRate(60, 0)).toBe(0);
    expect(requiredRate(60, Number.NaN)).toBeNull();
  });

  it("레이팅 상수가 0 이하인 난이도(4.5)는 null", () => {
    expect(requiredRate(45, 10)).toBeNull(); // 10×4.5−45 = 0
  });
});

function skillEntry(rank: number, score: number): SkillEntryResponse {
  return {
    rank, songDifficultyId: rank, songId: rank, title: `곡${rank}`, part: "GUITAR", difficulty: "MASTER", level: 9,
    tier: 6, pattern: "단일", achievementRate: 90, fullCombo: false, stage: "S", ratingConstant: 15, value: score / 20, score,
  };
}

describe("planTargets", () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => skillEntry(i + 1, 300 - i));

  it("단일은 1·7·15위, 그 외는 1·12·25위의 점수를 고른다", () => {
    expect(planTargets(list(15), "single")).toEqual([
      { rank: 1, score: 300 }, { rank: 7, score: 294 }, { rank: 15, score: 286 },
    ]);
    expect(planTargets(list(25), "other").map((t) => t.rank)).toEqual([1, 12, 25]);
  });

  it("목록이 덜 찼으면 있는 순위만 고른다", () => {
    expect(planTargets(list(10), "single").map((t) => t.rank)).toEqual([1, 7]);
    expect(planTargets(list(0), "other")).toEqual([]);
  });
});

function tableEntry(id: number, over: Partial<TableEntryResponse> = {}): TableEntryResponse {
  return {
    entryId: id, songDifficultyId: id, songId: id, title: `곡${id}`, addedVersion: null, part: "GUITAR", difficulty: "MASTER", level: 9,
    tierUncertain: false, recommend: "상", recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true, mine: null, ...over,
  };
}
function group(tier: number | null, entries: TableEntryResponse[]): TierGroupResponse {
  return { tier, total: entries.length, recorded: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries };
}

describe("planRows", () => {
  const targets = [{ rank: 1, score: 300 }, { rank: 15, score: 200 }];

  it("서열표 순서를 지킨다", () => {
    const rows = planRows([group(7.0, [tableEntry(1)]), group(6.0, [tableEntry(2)])], "single", targets);
    expect(rows.map((r) => r.tier)).toEqual([7.0, 6.0]);
  });

  it("6.0은 300점이 가능(94.07%), 5.5는 300점이 불가능하고 200점은 가능", () => {
    const rows = planRows([group(6.0, [tableEntry(2)]), group(5.5, [tableEntry(3)])], "single", targets);
    expect(rows[0].needs[0]).not.toBeNull();
    expect(rows[1].needs[0]).toBeNull();
    expect(rows[1].needs[1]).not.toBeNull();
  });

  it("기준 점수를 하나도 못 내는 난이도는 뺀다", () => {
    expect(planRows([group(5.0, [tableEntry(4)])], "single", [{ rank: 1, score: 300 }])).toEqual([]);
  });

  it("목록 종류에 맞는 속성·레이팅 반영 채보만 센다", () => {
    const groups = [
      group(6.5, [
        tableEntry(1, { pattern: "단일" }),
        tableEntry(2, { pattern: "복합" }),
        tableEntry(3, { pattern: "레이팅 제외" }),
        tableEntry(4, { pattern: "단일", ratingEnabled: false }),
        tableEntry(5, { pattern: null }),
      ]),
    ];
    expect(planRows(groups, "single", targets)[0].entries.map((e) => e.entryId)).toEqual([1]);
    expect(planRows(groups, "other", targets)[0].entries.map((e) => e.entryId)).toEqual([2]);
  });

  it("미정 묶음과 채보가 없는 난이도는 건너뛴다", () => {
    const rows = planRows([group(null, [tableEntry(1)]), group(6.5, [tableEntry(2, { pattern: "복합" })])], "single", targets);
    expect(rows).toEqual([]);
  });
});
