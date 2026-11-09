import { describe, expect, it } from "vitest";
import { badgeText, formatScoreDiff, relativeMinutes, signed } from "@/lib/rivals";

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
