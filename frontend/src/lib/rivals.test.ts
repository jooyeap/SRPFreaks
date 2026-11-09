import { describe, expect, it } from "vitest";
import type { RivalRatingRow } from "@/lib/api-types";
import { badgeText, catchUpRows, formatScoreDiff, relativeMinutes, signed } from "@/lib/rivals";

describe("라이벌 표시 도우미", () => {
  it("배지는 0이면 없고 9를 넘으면 9+다", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(3)).toBe("3");
    expect(badgeText(10)).toBe("9+");
  });

  it("점수 차 칩은 부호 글자로 앞(+)·뒤(−)·같음(±)을 보인다 (D65)", () => {
    expect(formatScoreDiff(2.28)).toEqual({ text: "+2.28", sign: "up" });
    expect(formatScoreDiff(-4.37)).toEqual({ text: "\u22124.37", sign: "down" }); // 진짜 마이너스 기호
    expect(formatScoreDiff(0)).toEqual({ text: "\u00b10.00", sign: "even" });
    expect(formatScoreDiff(null)).toBeNull();
  });

  it("점수 차 부호는 표시하는 둘째 자리 값으로 정한다(+0.00, −0.00이 나오지 않는다)", () => {
    expect(formatScoreDiff(0.004)).toEqual({ text: "\u00b10.00", sign: "even" });
    expect(formatScoreDiff(-0.004)).toEqual({ text: "\u00b10.00", sign: "even" });
    expect(formatScoreDiff(0.01)).toEqual({ text: "+0.01", sign: "up" });
    expect(formatScoreDiff(-0.01)).toEqual({ text: "\u22120.01", sign: "down" });
    // 부동소수점 찌꺼기(240.1 - 238.1 = 2.0000000000000284)도 둘째 자리로 정리된다
    expect(formatScoreDiff(240.1 - 238.1)).toEqual({ text: "+2.00", sign: "up" });
  });

  it("부호를 붙인 차이", () => {
    expect(signed(0.3)).toBe("+0.30");
    expect(signed(-1.62)).toBe("-1.62");
    expect(signed(0)).toBe("0.00");
  });

  it("상대 시각은 방금 · 분 · 시간 · 일로 나눈다", () => {
    const now = Date.parse("2026-10-31T06:00:00Z");
    expect(relativeMinutes("2026-10-31T05:59:30Z", now)).toEqual({ unit: "now", n: 0 });
    expect(relativeMinutes("2026-10-31T05:50:00Z", now)).toEqual({ unit: "minute", n: 10 });
    expect(relativeMinutes("2026-10-31T03:00:00Z", now)).toEqual({ unit: "hour", n: 3 });
    expect(relativeMinutes("2026-10-28T06:00:00Z", now)).toEqual({ unit: "day", n: 3 });
  });
});

describe("catchUpRows (D66 따라잡을 곡)", () => {
  const base: RivalRatingRow = {
    rank: 1, songDifficultyId: 1, songId: 1, title: "A", part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 5.4, pattern: "단일",
    rate: 95, stage: "SS", score: 240, myRate: 94, myScore: 238, diff: -2,
  };
  const r = (id: number, over: Partial<RivalRatingRow>): RivalRatingRow => ({ ...base, songDifficultyId: id, songId: id, title: `S${id}`, ...over });

  it("내가 뒤진 곡만, 차이가 작은 순으로 3곡을 고른다", () => {
    const rows = [r(1, { diff: -4.37 }), r(2, { diff: -1.85 }), r(3, { diff: 2.28 }), r(4, { diff: -0.5 }), r(5, { diff: -9 }), r(6, { diff: -3 })];
    expect(catchUpRows(rows).map((x) => x.songDifficultyId)).toEqual([4, 2, 6]);
  });

  it("동점(±0.00)·내 기록 없음은 뺀다. 표시 둘째 자리로 같으면(−0.004) 뒤진 것이 아니다", () => {
    const rows = [r(1, { diff: 0 }), r(2, { diff: -0.004 }), r(3, { myScore: null, myRate: null, diff: null }), r(4, { diff: -0.01 })];
    expect(catchUpRows(rows).map((x) => x.songDifficultyId)).toEqual([4]);
  });

  it("같은 차이면 상대 점수가 높은 곡이 먼저, 그다음 곡 id 순이다", () => {
    const rows = [r(3, { diff: -1, score: 200 }), r(1, { diff: -1, score: 200 }), r(2, { diff: -1, score: 240 })];
    expect(catchUpRows(rows).map((x) => x.songDifficultyId)).toEqual([2, 1, 3]);
  });

  it("3곡 미만이면 있는 만큼, 하나도 없으면 빈 목록이다", () => {
    expect(catchUpRows([r(1, { diff: -1 })])).toHaveLength(1);
    expect(catchUpRows([r(1, { diff: 1 }), r(2, { diff: 0 })])).toEqual([]);
    expect(catchUpRows([])).toEqual([]);
  });
});
