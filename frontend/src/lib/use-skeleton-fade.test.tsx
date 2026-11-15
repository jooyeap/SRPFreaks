import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSkeletonFade } from "@/lib/use-skeleton-fade";

describe("useSkeletonFade (D82, 모션 PR 6)", () => {
  it("스켈레톤을 거쳐 본문이 나타나면 페이드 클래스를 준다", () => {
    const { result, rerender } = renderHook(({ loading }) => useSkeletonFade(loading), { initialProps: { loading: true } });
    expect(result.current).toBe("");
    rerender({ loading: false });
    expect(result.current).toBe("motion-content-in");
  });

  it("처음부터 본문이면(캐시) 클래스가 없다", () => {
    const { result, rerender } = renderHook(({ loading }) => useSkeletonFade(loading), { initialProps: { loading: false } });
    expect(result.current).toBe("");
    rerender({ loading: false });
    expect(result.current).toBe("");
  });
});
