import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ONE_HAND_STORAGE_KEY, padInput, resetOneHandModeForTest, setOneHandMode, type PadKey } from "@/lib/one-hand";

/** 키를 차례로 눌러 만들어지는 글자 */
function press(...keys: PadKey[]): string {
  return keys.reduce((text, key) => padInput(text, key), "");
}

describe("padInput (숫자 패드, 소수점 없는 정수 0~10000)", () => {
  it("숫자를 이어 붙여 달성률 정수를 만든다 (9 9 5 8 → 9958 = 99.58)", () => {
    expect(press("9", "9", "5", "8")).toBe("9958");
  });

  it("10000을 넘는 값은 만들 수 없다 (경계: 10000 OK, 10001 막힘, 99999 막힘)", () => {
    expect(press("1", "0", "0", "0", "0")).toBe("10000");
    expect(press("1", "0", "0", "0", "1")).toBe("1000"); // 마지막 1은 10001이 되므로 막힘
    expect(press("9", "9", "9", "9", "9")).toBe("9999");
    expect(press("1", "0", "0", "0", "0", "0")).toBe("10000");
  });

  it("00 키는 두 자리를 한 번에 넣고, 빈 칸이나 0에서는 0 하나로 둔다", () => {
    expect(press("1", "00")).toBe("100");
    expect(press("1", "0", "00")).toBe("1000");
    expect(press("1", "00", "00")).toBe("10000");
    expect(press("00")).toBe("0");
    expect(press("0", "00")).toBe("0");
    expect(press("1", "00", "00", "00")).toBe("10000"); // 1000000은 막힘
  });

  it("첫 글자가 0이면 다음 숫자가 그 자리를 대신한다", () => {
    expect(press("0", "5")).toBe("5");
    expect(press("0", "0")).toBe("0");
  });

  it("지우기는 마지막 글자를 지우고, 비어 있으면 그대로다", () => {
    expect(press("9", "9", "5", "back")).toBe("99");
    expect(press("5", "back")).toBe("");
    expect(press("back")).toBe("");
  });
});

describe("한 손 입력 모드 저장", () => {
  beforeEach(() => {
    localStorage.clear();
    resetOneHandModeForTest();
  });
  afterEach(() => {
    localStorage.clear();
    resetOneHandModeForTest();
  });

  it("켜면 저장소에 1, 끄면 0을 남긴다", () => {
    setOneHandMode(true);
    expect(localStorage.getItem(ONE_HAND_STORAGE_KEY)).toBe("1");
    setOneHandMode(false);
    expect(localStorage.getItem(ONE_HAND_STORAGE_KEY)).toBe("0");
  });
});
