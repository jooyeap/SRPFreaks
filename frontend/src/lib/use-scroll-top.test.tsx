import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";

describe("useScrollTopOnChange", () => {
  const scrollTo = vi.fn();
  beforeEach(() => {
    scrollTo.mockReset();
    vi.stubGlobal("scrollTo", scrollTo);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("처음 그릴 때는 올리지 않는다", () => {
    renderHook(() => useScrollTopOnChange(0));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("값이 바뀌면 맨 위로 올리고, 같은 값이면 올리지 않는다", () => {
    const { rerender } = renderHook(({ page }) => useScrollTopOnChange(page), { initialProps: { page: 0 } });
    rerender({ page: 0 });
    expect(scrollTo).not.toHaveBeenCalled();
    rerender({ page: 1 });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    rerender({ page: 0 });
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });
});
