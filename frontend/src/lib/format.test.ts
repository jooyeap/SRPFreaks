import { describe, expect, it } from "vitest";
import {
  difficultyLabel,
  EMPTY_MARK,
  formatLevel,
  formatPlayedDate,
  formatRate,
  formatScore,
  formatTier,
  partLabel,
  toHundredths,
} from "@/lib/format";

describe("formatRate (달성률 표시)", () => {
  it("100.00은 MAX로 표시한다", () => {
    expect(formatRate(100)).toBe("MAX");
    expect(formatRate(100.0)).toBe("MAX");
  });

  it("그 외는 소수점 둘째 자리까지 표시한다", () => {
    expect(formatRate(86.78)).toBe("86.78");
    expect(formatRate(95.5)).toBe("95.50"); // JSON 숫자는 끝자리 0이 사라져 오므로 자리를 맞춘다
    expect(formatRate(0)).toBe("0.00");
    expect(formatRate(99.99)).toBe("99.99");
  });

  it("100.00 바로 아래(99.99)는 MAX가 아니다", () => {
    expect(formatRate(99.99)).not.toBe("MAX");
  });

  it("기록이 없거나 숫자가 아니면 –", () => {
    expect(formatRate(null)).toBe(EMPTY_MARK);
    expect(formatRate(undefined)).toBe(EMPTY_MARK);
    expect(formatRate(Number.NaN)).toBe(EMPTY_MARK);
    expect(formatRate(Number.POSITIVE_INFINITY)).toBe(EMPTY_MARK);
  });
});

describe("toHundredths (소수 오차 방지)", () => {
  it("소수를 100배 한 정수로 바꾼다", () => {
    expect(toHundredths(94.99)).toBe(9499);
    expect(toHundredths(0.29)).toBe(29); // 0.29 * 100 = 28.999999999999996 이지만 반올림으로 맞춘다
    expect(toHundredths(100)).toBe(10000);
  });

  it("숫자가 아니면 null", () => {
    expect(toHundredths(Number.NaN)).toBeNull();
  });
});

describe("partLabel / difficultyLabel", () => {
  it("파트는 Guitar / Bass로 표시한다", () => {
    expect(partLabel("GUITAR")).toBe("Guitar");
    expect(partLabel("BASS")).toBe("Bass");
  });

  it("난이도는 BAS / ADV / EXT / MAS로 표시한다", () => {
    expect(difficultyLabel("BASIC")).toBe("BAS");
    expect(difficultyLabel("ADVANCED")).toBe("ADV");
    expect(difficultyLabel("EXTREME")).toBe("EXT");
    expect(difficultyLabel("MASTER")).toBe("MAS");
  });
});

describe("formatTier (기준 난이도)", () => {
  it("0.1 단위로 표시한다", () => {
    expect(formatTier(6)).toBe("6.0");
    expect(formatTier(5.9)).toBe("5.9");
    expect(formatTier(6.8)).toBe("6.8");
  });

  it("값이 없으면 미정", () => {
    expect(formatTier(null)).toBe("미정");
    expect(formatTier(undefined)).toBe("미정");
  });
});

describe("formatLevel / formatScore", () => {
  it("레벨과 점수는 소수 둘째 자리로 맞춘다", () => {
    expect(formatLevel(9.8)).toBe("9.80");
    expect(formatScore(304)).toBe("304.00");
    expect(formatScore(448.77)).toBe("448.77");
  });

  it("점수가 없으면 –", () => {
    expect(formatScore(null)).toBe(EMPTY_MARK);
  });
});

describe("formatPlayedDate (UTC -> Asia/Seoul)", () => {
  it("UTC 시각을 서울 날짜로 바꾼다 (날짜가 넘어가는 경우 포함)", () => {
    expect(formatPlayedDate("2026-10-04T16:00:00Z")).toBe("2026-10-05"); // UTC 16:00 = 서울 다음 날 01:00
    expect(formatPlayedDate("2026-10-04T14:59:59Z")).toBe("2026-10-04"); // 서울 23:59:59
    expect(formatPlayedDate("2026-10-04T15:00:00Z")).toBe("2026-10-05"); // 서울 자정
  });

  it("값이 없거나 올바르지 않으면 –", () => {
    expect(formatPlayedDate(null)).toBe(EMPTY_MARK);
    expect(formatPlayedDate("")).toBe(EMPTY_MARK);
    expect(formatPlayedDate("날짜아님")).toBe(EMPTY_MARK);
  });
});
