import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ONE_HAND_STORAGE_KEY, padInput, resetOneHandModeForTest, setOneHandMode, type PadKey } from "@/lib/one-hand";

/** 키를 차례로 눌러 만들어지는 글자 */
function press(...keys: PadKey[]): string {
  return keys.reduce((text, key) => padInput(text, key), "");
}

describe("padInput (숫자 패드)", () => {
  it("숫자를 이어 붙여 달성률을 만든다 (9 9 . 5 8 → 99.58)", () => {
    expect(press("9", "9", ".", "5", "8")).toBe("99.58");
  });

  it("소수점은 한 번만, 비어 있으면 0.으로 시작한다", () => {
    expect(press(".")).toBe("0.");
    expect(press("9", ".", ".")).toBe("9.");
  });

  it("소수 둘째 자리를 넘는 입력은 무시한다 (99.58 뒤의 1)", () => {
    expect(press("9", "9", ".", "5", "8", "1")).toBe("99.58");
  });

  it("100을 넘는 값은 만들 수 없다 (경계: 100 OK, 101 막힘, 100.5 막힘, 100.00 OK)", () => {
    expect(press("1", "0", "0")).toBe("100");
    expect(press("1", "0", "1")).toBe("10"); // 101은 막혀서 10에 머문다
    expect(press("1", "0", "0", "0")).toBe("100");
    expect(press("1", "0", "0", ".", "5")).toBe("100.");
    expect(press("1", "0", "0", ".", "0", "0")).toBe("100.00");
    expect(press("9", "9", "9")).toBe("99"); // 세 번째 9는 999가 되므로 막힘
  });

  it("첫 글자가 0이면 다음 숫자가 그 자리를 대신하고, 0.은 유지한다", () => {
    expect(press("0", "5")).toBe("5");
    expect(press("0", ".", "0", "5")).toBe("0.05");
    expect(press("0", "0")).toBe("0");
  });

  it("지우기는 마지막 글자를 지우고, 비어 있으면 그대로다", () => {
    expect(press("9", "9", ".", "5", "back")).toBe("99.");
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
