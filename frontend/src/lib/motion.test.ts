import { describe, expect, it } from "vitest";
import { BAR_LIMIT, STAGGER_LIMIT, barFill, stagger } from "@/lib/motion";

describe("stagger (D82, 모션 PR 3)", () => {
  it("처음 8줄만 등장 모션 클래스와 줄 번호를 받는다", () => {
    expect(STAGGER_LIMIT).toBe(8);
    for (let i = 0; i < 8; i++) {
      const s = stagger(i);
      expect(s.className).toBe("motion-stagger");
      expect((s.style as Record<string, unknown>)["--stagger-i"]).toBe(i);
    }
  });

  it("9번째 줄부터와 번호가 없을 때는 아무것도 붙이지 않는다(더 보기로 이어 붙는 줄 포함)", () => {
    for (const i of [8, 9, 20, 100, -1, undefined]) {
      expect(stagger(i)).toEqual({ className: "", style: undefined });
    }
  });
});

describe("barFill (D82, 모션 PR 5)", () => {
  it("처음 나타나는 막대만 모션 클래스를 받는다", () => {
    expect(barFill(true).className).toBe("motion-bar-fill");
    expect(barFill(false)).toEqual({ className: "", style: undefined });
  });

  it("목록에서는 처음 8개까지만 받고 번호마다 지연 변수를 받는다", () => {
    expect(BAR_LIMIT).toBe(8);
    expect(barFill(true, 0).style).toBeUndefined();
    expect((barFill(true, 3).style as Record<string, unknown>)["--bar-i"]).toBe(3);
    for (const i of [8, 9, 50, -1]) expect(barFill(true, i)).toEqual({ className: "", style: undefined });
  });

  it("오른쪽에서 채우는 막대는 rtl 클래스를 더한다", () => {
    expect(barFill(true, 0, true).className).toBe("motion-bar-fill motion-bar-fill-rtl");
  });
});
