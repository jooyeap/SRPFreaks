import { describe, expect, it } from "vitest";
import type { ChartFolderResponse } from "@/lib/api-types";
import type { ProgressGroup } from "@/lib/difficulty-table";
import { folderProgress, nextGoal, percentOf, tileTint, weakestGroup, weakestGroupNear } from "@/lib/progress";

function folder(over: Partial<ChartFolderResponse>): ChartFolderResponse {
  return { lo: 9.5, hi: 9.99, total: 10, recorded: 6, exc: 1, fc: 1, ss: 1, s: 2, belowS: 1, averageRecorded: 90, averageWithZero: 54, subFolders: [], ...over };
}

function pg(over: Partial<ProgressGroup>): ProgressGroup {
  return { key: "6.0", label: "6.0", href: "/table/folder/6.0", total: 10, recorded: 5, exc: 0, fc: 0, ss: 0, s: 0, belowS: 5, ...over };
}

describe("folderProgress", () => {
  it("폴더별 개수를 합치고 폴더 이름·순서를 유지한다", () => {
    const p = folderProgress([folder({ lo: 9.5, hi: 9.99 }), folder({ lo: 9, hi: 9.49, total: 20, recorded: 4, exc: 0, fc: 0, ss: 1, s: 1, belowS: 2 })]);
    expect(p).toMatchObject({ total: 30, recorded: 10, exc: 1, fc: 1, ss: 2, s: 3, belowS: 3 });
    expect(p.groups.map((g) => g.label)).toEqual(["9.50 ~ 9.99", "9.00 ~ 9.49"]);
    expect(p.groups[0]).toMatchObject({ key: "9.5", href: "/songs", total: 10, recorded: 6 });
  });
  it("폴더가 없으면 모두 0", () => {
    expect(folderProgress([])).toMatchObject({ total: 0, recorded: 0, groups: [] });
  });
});

describe("percentOf", () => {
  it("반올림한 정수 비율이고 전체가 0이면 0", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe("nextGoal", () => {
  it("SS 이상(EXC+FC+SS)을 다음 10곡 단위까지 올리는 목표를 만든다", () => {
    expect(nextGoal({ total: 100, exc: 3, fc: 6, ss: 9 })).toEqual({ current: 18, target: 20, left: 2 });
  });
  it("정확히 10의 배수이면 그다음 10곡 단위가 목표다", () => {
    expect(nextGoal({ total: 100, exc: 5, fc: 5, ss: 10 })).toEqual({ current: 20, target: 30, left: 10 });
  });
  it("0곡이면 첫 목표는 10곡", () => {
    expect(nextGoal({ total: 100, exc: 0, fc: 0, ss: 0 })).toEqual({ current: 0, target: 10, left: 10 });
  });
  it("목표가 전체를 넘지 않는다", () => {
    expect(nextGoal({ total: 24, exc: 10, fc: 10, ss: 1 })).toEqual({ current: 21, target: 24, left: 3 });
  });
  it("전체가 0이거나 전부 SS 이상이면 목표가 없다", () => {
    expect(nextGoal({ total: 0, exc: 0, fc: 0, ss: 0 })).toBeNull();
    expect(nextGoal({ total: 5, exc: 2, fc: 2, ss: 1 })).toBeNull();
  });
});

describe("weakestGroup", () => {
  it("기록 비율이 가장 낮은 묶음과 기록 없는 채보 수를 돌려준다", () => {
    const w = weakestGroup([pg({ key: "6.0", total: 10, recorded: 5 }), pg({ key: "5.9", label: "5.9", total: 20, recorded: 4 }), pg({ key: "5.8", total: 10, recorded: 10 })]);
    expect(w?.group.key).toBe("5.9");
    expect(w?.empty).toBe(16);
  });
  it("비율이 같으면 기록 없는 채보가 더 많은 묶음", () => {
    const w = weakestGroup([pg({ key: "a", total: 10, recorded: 5 }), pg({ key: "b", total: 20, recorded: 10 })]);
    expect(w?.group.key).toBe("b");
  });
  it("미정 묶음과 전체가 0인 묶음은 후보가 아니다", () => {
    const w = weakestGroup([pg({ key: "undecided", total: 10, recorded: 0 }), pg({ key: "z", total: 0, recorded: 0 }), pg({ key: "6.0", total: 10, recorded: 9 })]);
    expect(w?.group.key).toBe("6.0");
  });
  it("모두 채웠거나 후보가 없으면 null", () => {
    expect(weakestGroup([pg({ total: 3, recorded: 3 })])).toBeNull();
    expect(weakestGroup([])).toBeNull();
  });
});

describe("weakestGroupNear (내 평균 ±0.2 안에서만 고른다)", () => {
  const rows = [
    pg({ key: "5.8", total: 10, recorded: 0 }),
    pg({ key: "5.9", total: 10, recorded: 5 }),
    pg({ key: "6.0", total: 10, recorded: 8 }),
    pg({ key: "6.1", total: 10, recorded: 9 }),
    pg({ key: "6.2", total: 10, recorded: 9 }),
    pg({ key: "6.3", total: 10, recorded: 9 }),
    pg({ key: "6.4", total: 10, recorded: 0 }),
    pg({ key: "merged-high", total: 40, recorded: 0 }),
  ];
  it("평균 6.1이면 5.9~6.3만 후보다 (범위 밖 5.8·6.4가 더 비어 있어도 뽑지 않는다)", () => {
    expect(weakestGroupNear(rows, 6.1)?.group.key).toBe("5.9");
  });
  it("경계는 포함한다: 평균 6.10 → 5.9와 6.3 모두 후보, 평균 6.11 → 5.9는 0.21 차이라 빠진다", () => {
    expect(weakestGroupNear([pg({ key: "5.9", total: 10, recorded: 0 })], 6.1)?.group.key).toBe("5.9");
    expect(weakestGroupNear([pg({ key: "6.3", total: 10, recorded: 0 })], 6.1)?.group.key).toBe("6.3");
    expect(weakestGroupNear([pg({ key: "5.9", total: 10, recorded: 0 })], 6.11)).toBeNull();
  });
  it("소수 둘째 자리 평균도 정수(100배)로 비교한다 (6.13 → 5.93 이상이 후보, 5.9는 제외)", () => {
    expect(weakestGroupNear([pg({ key: "5.9", total: 10, recorded: 0 })], 6.13)).toBeNull();
    expect(weakestGroupNear([pg({ key: "6.0", total: 10, recorded: 0 })], 6.13)?.group.key).toBe("6.0");
  });
  it("합친 `6.5 이상` 줄은 범위가 6.5에 닿을 때만 후보다 (평균 6.3이면 6.5까지 닿는다, 6.29면 닿지 않는다)", () => {
    const merged = [pg({ key: "merged-high", total: 40, recorded: 0 })];
    expect(weakestGroupNear(merged, 6.3)?.group.key).toBe("merged-high");
    expect(weakestGroupNear(merged, 6.29)).toBeNull();
  });
  it("범위 안 구간이 모두 채워졌거나 후보가 없으면 null (미정 등 숫자가 아닌 키도 후보가 아니다)", () => {
    expect(weakestGroupNear([pg({ key: "6.0", total: 3, recorded: 3 })], 6.0)).toBeNull();
    expect(weakestGroupNear([pg({ key: "undecided", total: 5, recorded: 0 })], 6.0)).toBeNull();
    expect(weakestGroupNear([], 6.0)).toBeNull();
  });
});

describe("tileTint", () => {
  it("많이 채울수록 진해진다 (0% → 4/18, 100% → 24/63)", () => {
    expect(tileTint(0, 10)).toEqual({ fill: 4, line: 18 });
    expect(tileTint(10, 10)).toEqual({ fill: 24, line: 63 });
    expect(tileTint(5, 10)).toEqual({ fill: 14, line: 41 });
  });
  it("전체가 0이면 가장 연한 값", () => {
    expect(tileTint(0, 0)).toEqual({ fill: 4, line: 18 });
  });
});
