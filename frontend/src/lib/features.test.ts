import { describe, expect, it } from "vitest";
import { canUseImport, IMPORT_FEATURE_ENABLED } from "@/lib/features";

describe("canUseImport", () => {
  it("모두에게 열려 있으면(IMPORT_FEATURE_ENABLED=true) 로그인한 모든 역할이 쓸 수 있다", () => {
    expect(IMPORT_FEATURE_ENABLED).toBe(true);
    expect(canUseImport("ROOT")).toBe(true);
    expect(canUseImport("ADMIN")).toBe(true);
    expect(canUseImport("USER")).toBe(true);
  });

  it("닫으면(enabled=false) 다시 ROOT만 쓸 수 있다: 문제가 생겨 되돌릴 때의 동작", () => {
    expect(canUseImport("ROOT", false)).toBe(true);
    expect(canUseImport("ADMIN", false)).toBe(false);
    expect(canUseImport("USER", false)).toBe(false);
    expect(canUseImport(undefined, false)).toBe(false);
  });

  it("역할을 모르는 동안(로그인 전·확인 중)에도 화면은 막지 않는다. 실제로 막는 곳은 서버다", () => {
    expect(canUseImport(undefined)).toBe(true);
  });
});
