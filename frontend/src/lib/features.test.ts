import { describe, expect, it } from "vitest";
import { canUseImport, IMPORT_FEATURE_ENABLED } from "@/lib/features";

describe("canUseImport", () => {
  it("모두에게 열기 전(IMPORT_FEATURE_ENABLED=false)에는 ROOT만 쓸 수 있다", () => {
    expect(IMPORT_FEATURE_ENABLED).toBe(false);
    expect(canUseImport("ROOT")).toBe(true);
    expect(canUseImport("ADMIN")).toBe(false);
    expect(canUseImport("USER")).toBe(false);
    expect(canUseImport(undefined)).toBe(false);
  });
});
