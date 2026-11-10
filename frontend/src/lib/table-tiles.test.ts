import { afterEach, describe, expect, it, vi } from "vitest";
import {
  averageTenth,
  defaultOrder,
  foldRange,
  layoutTiles,
  markIntroPlayed,
  markTipSeen,
  resetTableTilesForTest,
  wasIntroPlayed,
  wasTipSeen,
} from "@/lib/table-tiles";

/** 4.9 ~ 7.0 (0.1 단위) 타일 22개 */
const tiles = Array.from({ length: 22 }, (_, i) => ({ tier: (49 + i) / 10 }));
const tiersOf = (list: readonly { tier: number }[]) => list.map((t) => t.tier);

describe("layoutTiles (평균 근처 3칸 + 접힘)", () => {
  it("어려운 순: 평균 5.8이면 위로 5.9·6.0·6.1까지 보이고 6.2~7.0(9개)은 접는다", () => {
    const layout = layoutTiles(tiles, 5.8, "hard");
    expect(layout.averageTier).toBe(5.8);
    expect(layout.ordered[0].tier).toBe(7.0);
    expect(layout.folded).toHaveLength(9);
    expect(foldRange(layout.folded)).toEqual({ from: "6.2", to: "7.0" });
    expect(tiersOf(layout.ordered.slice(layout.folded.length, layout.folded.length + 4))).toEqual([6.1, 6.0, 5.9, 5.8]);
  });

  it("쉬운 순: 평균 아래로 3칸(5.5·5.6·5.7)까지 보이고 4.9~5.4(6개)는 접는다", () => {
    const layout = layoutTiles(tiles, 5.8, "easy");
    expect(layout.ordered[0].tier).toBe(4.9);
    expect(foldRange(layout.folded)).toEqual({ from: "4.9", to: "5.4" });
    expect(layout.folded).toHaveLength(6);
  });

  it("경계: 평균이 맨 위(7.0)이면 접을 것이 없다", () => {
    const layout = layoutTiles(tiles, 7.0, "hard");
    expect(layout.averageTier).toBe(7.0);
    expect(layout.folded).toEqual([]);
  });

  it("경계: 평균이 맨 아래(4.9)이고 어려운 순이면 위쪽 타일이 많아 접히지만, 쉬운 순이면 접을 것이 없다", () => {
    expect(layoutTiles(tiles, 4.9, "easy").folded).toEqual([]);
    expect(layoutTiles(tiles, 4.9, "hard").folded).toHaveLength(tiles.length - 1 - 3);
  });

  it("경계: 평균 위 타일이 3칸이면 접지 않고, 4칸이어도 접힐 게 1개뿐이면 접지 않는다(줄 하나로 바꿀 이득이 없다)", () => {
    expect(layoutTiles(tiles, 6.7, "hard").folded).toEqual([]); // 6.8·6.9·7.0 = 3칸
    expect(layoutTiles(tiles, 6.6, "hard").folded).toEqual([]); // 4칸 -> 접힐 1개
    expect(layoutTiles(tiles, 6.5, "hard").folded).toHaveLength(2); // 5칸 -> 접힐 2개
  });

  it("평균이 없으면 접지 않고 평균 타일도 없다", () => {
    const layout = layoutTiles(tiles, null, "easy");
    expect(layout.folded).toEqual([]);
    expect(layout.averageTier).toBeNull();
    expect(layout.ordered).toHaveLength(22);
  });

  it("평균 값이 타일 사이에 있으면 가장 가까운 타일을, 같은 거리면 낮은 쪽을 평균 타일로 본다", () => {
    const sparse = [{ tier: 5.0 }, { tier: 5.4 }, { tier: 5.9 }];
    expect(layoutTiles(sparse, 5.6, "hard").averageTier).toBe(5.4);
    expect(layoutTiles(sparse, 5.2, "hard").averageTier).toBe(5.0); // 5.0과 5.4가 같은 거리 -> 낮은 쪽
    expect(layoutTiles(sparse, 9, "hard").averageTier).toBe(5.9);
  });

  it("서버 평균(둘째 자리)은 0.1 단위로 맞춘다 (5.84 -> 5.8, 5.85 -> 5.9)", () => {
    expect(averageTenth(5.84)).toBe(5.8);
    expect(averageTenth(5.85)).toBe(5.9);
    expect(layoutTiles(tiles, 5.84, "hard").averageTier).toBe(5.8);
  });

  it("타일이 없으면 빈 결과", () => {
    expect(layoutTiles([], 5.8, "hard")).toEqual({ ordered: [], folded: [], averageTier: null });
  });
});

describe("정렬 기본값", () => {
  it("평균이 있으면 어려운 순, 없으면 쉬운 순", () => {
    expect(defaultOrder(true)).toBe("hard");
    expect(defaultOrder(false)).toBe("easy");
  });
});

describe("기억 (첫 진입 연출 · 안내 말풍선)", () => {
  afterEach(() => {
    resetTableTilesForTest();
    vi.restoreAllMocks();
  });

  it("첫 진입 연출은 한 번 표시하면 같은 탭에서 다시 하지 않는다", () => {
    expect(wasIntroPlayed()).toBe(false);
    markIntroPlayed();
    expect(wasIntroPlayed()).toBe(true);
    resetTableTilesForTest(); // 메모리만 비워도 sessionStorage에서 읽는다
    expect(wasIntroPlayed()).toBe(true);
  });

  it("저장소를 못 써도 던지지 않는다 (연출은 메모리로 유지, 안내는 안 본 것으로 본다)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(wasTipSeen()).toBe(false);
    expect(() => markTipSeen()).not.toThrow();
    expect(wasIntroPlayed()).toBe(false);
    expect(() => markIntroPlayed()).not.toThrow();
    expect(wasIntroPlayed()).toBe(true);
  });

  it("안내를 닫았다는 기억은 이 기기에 남는다", () => {
    expect(wasTipSeen()).toBe(false);
    markTipSeen();
    expect(wasTipSeen()).toBe(true);
  });
});
