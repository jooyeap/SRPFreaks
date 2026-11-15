import { describe, expect, it } from "vitest";
import { STAGGER_LIMIT, stagger } from "@/lib/motion";

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
