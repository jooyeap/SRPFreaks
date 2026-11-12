import { describe, expect, it } from "vitest";
import { createTranslator } from "use-intl/core";
import koMessages from "../../messages/ko.json";
import {
  achievementFromInput,
  cutlineProgress,
  gapWithUnit,
  initialInput,
  makeSimulationSchema,
  QUICK_RATES,
  rateWithUnit,
  type RatingSimulationResponse,
} from "@/lib/rating-simulation";
import type { Translator } from "@/i18n/translator";

const t = createTranslator({ locale: "ko", messages: koMessages }) as unknown as Translator;
const schema = makeSimulationSchema(t);

function data(over: Partial<RatingSimulationResponse> = {}): RatingSimulationResponse {
  return {
    status: "NO_RECORD",
    notRatedReason: null,
    group: "SINGLE",
    groupLimit: 15,
    groupSize: 15,
    currentRate: null,
    currentScore: null,
    currentRank: null,
    cutline: { lastScore: 240, requiredRate: 80.01, reachable: true, rateGap: null, groupFull: true },
    simulation: null,
    ...over,
  };
}

describe("목표 달성률 입력 검사 (소수점 없는 정수 0~10000, ÷100이 달성률)", () => {
  it.each(["0", "8001", "9500", "10000", "965"])("%s은 통과한다", (value) => {
    expect(schema.safeParse({ achievementRate: value }).success).toBe(true);
  });

  it.each([
    ["", "달성률은 필수입니다."],
    ["10001", "달성률은 0 이상 10000 이하여야 합니다."],
    ["-1", "달성률은 소수점 없는 정수로 입력해 주세요."],
    ["95.55", "달성률은 소수점 없는 정수로 입력해 주세요."],
    ["abc", "달성률은 소수점 없는 정수로 입력해 주세요."],
  ])("%s은 거부한다", (value, message) => {
    const parsed = schema.safeParse({ achievementRate: value });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(message);
  });
});

describe("입력 글자 -> 서버에 보낼 달성률 (경계값 0.00, 100.00, 소수 둘째 자리)", () => {
  it("0.00과 100.00은 인정하고, 범위 밖과 숫자가 아닌 값은 요청하지 않는다", () => {
    expect(achievementFromInput("0")).toBe(0);
    expect(achievementFromInput("10000")).toBe(100);
    expect(achievementFromInput("9971")).toBe(99.71);
    expect(achievementFromInput("10001")).toBeNull();
    expect(achievementFromInput("-1")).toBeNull();
    expect(achievementFromInput("95.55")).toBeNull();
    expect(achievementFromInput("")).toBeNull();
  });

  it("빠른 칩은 95·97·99·MAX이고 모두 입력 규칙 안의 값이다", () => {
    expect(QUICK_RATES.map((c) => c.label)).toEqual(["95%", "97%", "99%", "MAX"]);
    expect(QUICK_RATES.map((c) => achievementFromInput(c.input))).toEqual([95, 97, 99, 100]);
  });
});

describe("표시", () => {
  it("달성률은 100.00이면 MAX, 그 외는 둘째 자리 + %", () => {
    expect(rateWithUnit(100)).toBe("MAX");
    expect(rateWithUnit(80.01)).toBe("80.01%");
    expect(rateWithUnit(0)).toBe("0.00%");
  });

  it("더 올릴 양은 부호를 붙이고, 0이면 부호가 없다", () => {
    expect(gapWithUnit(10.01)).toBe("+10.01%");
    expect(gapWithUnit(0)).toBe("0.00%");
    expect(gapWithUnit(-9.99)).toBe("-9.99%");
  });
});

describe("입력칸 처음 값과 진행 막대", () => {
  it("기록 없음·목록 밖은 컷라인 달성률에서 시작하고, 이미 안이거나 도달 불가면 비운다", () => {
    expect(initialInput(data())).toBe("8001");
    expect(initialInput(data({ status: "OUT_OF_LIST" }))).toBe("8001");
    expect(initialInput(data({ status: "IN_LIST" }))).toBe("");
    expect(initialInput(data({ cutline: { lastScore: 384, requiredRate: null, reachable: false, rateGap: null, groupFull: true } }))).toBe("");
  });

  it("진행 막대: 기록 없음 0, 목록 밖은 컷라인 대비 비율, 이미 안이면 가득", () => {
    expect(cutlineProgress(data())).toBe(0);
    expect(cutlineProgress(data({ status: "OUT_OF_LIST", currentRate: 40.005 }))).toBeCloseTo(0.5, 2);
    expect(cutlineProgress(data({ status: "IN_LIST", currentRate: 90 }))).toBe(1);
    expect(cutlineProgress(data({ cutline: { lastScore: null, requiredRate: 0, reachable: true, rateGap: null, groupFull: false } }))).toBe(1);
  });
});
