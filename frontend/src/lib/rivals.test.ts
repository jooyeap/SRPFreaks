import { describe, expect, it } from "vitest";
import { badgeText, formatDiff, relativeMinutes, signed } from "@/lib/rivals";

describe("라이벌 표시 도우미", () => {
  it("배지는 0이면 없고 9를 넘으면 9+다", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(3)).toBe("3");
    expect(badgeText(10)).toBe("9+");
  });

  it("차이는 화살표 글자로도 높음·낮음을 보인다", () => {
    expect(formatDiff(1.9)).toEqual({ text: "1.90↑", sign: "up" });
    expect(formatDiff(-3.4)).toEqual({ text: "3.40↓", sign: "down" });
    expect(formatDiff(0)).toEqual({ text: "0.00", sign: "even" });
    expect(formatDiff(null)).toBeNull();
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
