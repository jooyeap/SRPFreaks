import { describe, expect, it } from "vitest";
import type { TableEntryResponse } from "@/lib/api-types";
import { tableEntrySchema, tableEntryToFormValues, toTableEntryBody } from "@/lib/table-entry-admin";

const entry: TableEntryResponse = {
  entryId: 1,
  songDifficultyId: 10,
  songId: 1,
  title: "곡",
  addedVersion: "V5",
  part: "GUITAR",
  difficulty: "MASTER",
  level: 9.8,
  tierUncertain: true,
  recommend: "상",
  recommendUncertain: true,
  pattern: "복합",
  patternUncertain: false,
  mine: null,
};

function check(tier: string, recommend = "", pattern = "") {
  return tableEntrySchema.safeParse({ tier, recommend, pattern });
}

describe("tableEntrySchema", () => {
  it("기준 난이도는 비워도 되고(미정) 소수 첫째 자리까지의 숫자는 통과한다", () => {
    for (const tier of ["", "  ", "0", "0.0", "5.8", "6", "10.5", "99.9"]) {
      expect(check(tier).success, tier).toBe(true);
    }
  });

  it("음수, 소수 둘째 자리 이상, 숫자가 아닌 값, 세 자리 정수는 거부한다", () => {
    for (const tier of ["-0.1", "5.85", "5.855", "abc", "1e1", "100", "5,8", "5."]) {
      expect(check(tier).success, tier).toBe(false);
    }
  });

  it("소수 둘째 자리는 그에 맞는 문구를 준다", () => {
    const result = check("5.85");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("기준 난이도는 소수 첫째 자리까지만 입력할 수 있습니다.");
  });

  it("추천도는 상/중/하, 속성은 단일/복합/이중/삼중/레이팅 제외만 받는다", () => {
    for (const recommend of ["", "상", "중", "하"]) expect(check("5.8", recommend).success, recommend).toBe(true);
    for (const pattern of ["", "단일", "복합", "이중", "삼중", "레이팅 제외"]) {
      expect(check("5.8", "", pattern).success, pattern).toBe(true);
    }
    expect(check("5.8", "최상").success).toBe(false);
    expect(check("5.8", "", "SINGLE").success).toBe(false);
  });
});

describe("toTableEntryBody", () => {
  it("값이 있으면 숫자와 한글 값 그대로, 비웠으면 null로 보낸다", () => {
    expect(toTableEntryBody({ tier: "5.8", recommend: "상", pattern: "레이팅 제외" })).toEqual({
      tierLabel: 5.8,
      recommend: "상",
      pattern: "레이팅 제외",
    });
    expect(toTableEntryBody({ tier: " ", recommend: "", pattern: "" })).toEqual({
      tierLabel: null,
      recommend: null,
      pattern: null,
    });
  });
});

describe("tableEntryToFormValues", () => {
  it("지금 값으로 초기값을 만든다 (기준 난이도는 소수 첫째 자리 문자열)", () => {
    expect(tableEntryToFormValues(6, entry)).toEqual({ tier: "6.0", recommend: "상", pattern: "복합" });
  });

  it("표에 없는 채보나 값이 없는 줄은 비운 채로 시작한다", () => {
    expect(tableEntryToFormValues(null, null)).toEqual({ tier: "", recommend: "", pattern: "" });
    expect(tableEntryToFormValues(null, { ...entry, recommend: null, pattern: null })).toEqual({
      tier: "",
      recommend: "",
      pattern: "",
    });
  });

  it("알 수 없는 문자열은 빈 값으로 둔다 (선택 목록에 없는 값을 넣지 않는다)", () => {
    expect(tableEntryToFormValues(5, { ...entry, pattern: "알 수 없음" }).pattern).toBe("");
  });
});
