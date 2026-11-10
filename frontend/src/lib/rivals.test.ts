import { describe, expect, it } from "vitest";
import type { RivalRatingRow } from "@/lib/api-types";
import { badgeText, catchUpRows, formatRateDiff, formatRateGap, formatScoreDiff, relativeMinutes, signed } from "@/lib/rivals";

describe("라이벌 표시 도우미", () => {
  it("배지는 0이면 없고 9를 넘으면 9+다", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(3)).toBe("3");
    expect(badgeText(10)).toBe("9+");
  });

  it("평균 달성률 차는 부호 글자로 앞(+)·뒤(−)·같음(±)을 %와 함께 보이고, 값이 없으면 null이다 (D67 개정)", () => {
    expect(formatRateDiff(1.8)).toBe("+1.8%");
    expect(formatRateDiff(-0.4)).toBe("\u22120.4%"); // 진짜 마이너스 기호
    expect(formatRateDiff(0)).toBe("\u00b10.0%");
    expect(formatRateDiff(-0)).toBe("\u00b10.0%");
    expect(formatRateDiff(0.04)).toBe("\u00b10.0%"); // 표시 첫째 자리가 0이면 부호도 ±
    expect(formatRateDiff(-0.04)).toBe("\u00b10.0%"); // −0.0이 나오지 않는다
    expect(formatRateDiff(-12.3)).toBe("\u221212.3%");
    expect(formatRateDiff(100)).toBe("+100.0%");
    expect(formatRateDiff(null)).toBeNull();
    expect(formatRateDiff(undefined)).toBeNull();
  });

  it("곡 줄 달성률 차는 내 − 상대를 둘째 자리 %로, 부호 글자로 앞(+)·뒤(−)·같음(±) 보이고 기록이 없으면 null이다 (2026-11-09)", () => {
    expect(formatRateGap(97.84, 96)).toEqual({ text: "+1.84%", sign: "up" });
    expect(formatRateGap(90, 92.1)).toEqual({ text: "\u22122.10%", sign: "down" }); // 진짜 마이너스 기호
    expect(formatRateGap(95.2, 95.2)).toEqual({ text: "\u00b10.00%", sign: "even" });
    expect(formatRateGap(0.3, 0.1 + 0.2)).toEqual({ text: "\u00b10.00%", sign: "even" }); // 부동소수점 찌꺼기
    expect(formatRateGap(96.01, 96)).toEqual({ text: "+0.01%", sign: "up" });
    expect(formatRateGap(95.99, 96)).toEqual({ text: "\u22120.01%", sign: "down" });
    expect(formatRateGap(100, 80)).toEqual({ text: "+20.00%", sign: "up" });
    expect(formatRateGap(null, 90)).toBeNull();
    expect(formatRateGap(90, null)).toBeNull();
    expect(formatRateGap(undefined, 90)).toBeNull();
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

describe("catchUpRows (D66 따라잡을 곡, 달성률 차 기준 — D67 개정)", () => {
  const base: RivalRatingRow = {
    rank: 1, songDifficultyId: 1, songId: 1, title: "A", part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 5.4, pattern: "단일",
    rate: 95, stage: "SS", score: 240, myRate: 94, myScore: 238, diff: -2,
  };
  /** 곡 한 줄: gap = 내 달성률 − 상대 달성률(%p). 점수 차(diff)는 일부러 0으로 둔다(95% 이상은 점수가 같다 — 뽑는 기준이 점수 차가 아님을 확인). */
  const r = (id: number, gap: number | null, over: Partial<RivalRatingRow> = {}): RivalRatingRow => ({
    ...base,
    songDifficultyId: id,
    songId: id,
    title: `S${id}`,
    myRate: gap === null ? null : Math.round((95 + gap) * 100) / 100,
    myScore: gap === null ? null : 240,
    diff: gap === null ? null : 0,
    ...over,
  });

  it("내가 뒤진 곡만, 달성률 차가 작은 순으로 3곡을 고른다", () => {
    const rows = [r(1, -4.37), r(2, -1.85), r(3, 2.28), r(4, -0.5), r(5, -9), r(6, -3)];
    expect(catchUpRows(rows).map((x) => x.songDifficultyId)).toEqual([4, 2, 6]);
  });

  it("점수 차가 0이어도(달성률 95 이상) 달성률로 뒤졌으면 뽑는다: `뒤진 곡인데 +/±로 보이는` 어긋남이 없다", () => {
    const picked = catchUpRows([r(1, -2.1, { diff: 0 }), r(2, 0.5, { diff: 0 }), r(3, 0, { diff: 0 })]);
    expect(picked.map((x) => x.songDifficultyId)).toEqual([1]);
    // 뽑힌 곡의 칩은 항상 `−`다
    expect(formatRateGap(picked[0].myRate, picked[0].rate)).toEqual({ text: "\u22122.10%", sign: "down" });
  });

  it("동점(±0.00)·내 기록 없음은 뺀다. 표시 둘째 자리로 같으면(−0.004) 뒤진 것이 아니다", () => {
    const rows = [r(1, 0), r(2, -0.004, { myRate: 94.996 }), r(3, null), r(4, -0.01)];
    expect(catchUpRows(rows).map((x) => x.songDifficultyId)).toEqual([4]);
  });

  it("같은 차이면 상대 점수가 높은 곡이 먼저, 그다음 곡 id 순이다", () => {
    const rows = [r(3, -1, { score: 200 }), r(1, -1, { score: 200 }), r(2, -1, { score: 240 })];
    expect(catchUpRows(rows).map((x) => x.songDifficultyId)).toEqual([2, 1, 3]);
  });

  it("3곡 미만이면 있는 만큼, 하나도 없으면 빈 목록이다", () => {
    expect(catchUpRows([r(1, -1)])).toHaveLength(1);
    expect(catchUpRows([r(1, 1), r(2, 0)])).toEqual([]);
    expect(catchUpRows([])).toEqual([]);
  });
});
