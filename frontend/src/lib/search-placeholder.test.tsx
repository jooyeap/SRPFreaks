import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSearchPlaceholder } from "@/lib/search-placeholder";

function mockWidth(wide: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: wide && query === "(min-width: 640px)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("곡 검색창 안내 글자", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("좁은 화면(640px 미만)은 짧은 문구를 쓴다 (긴 문구는 끝이 잘려서)", () => {
    mockWidth(false);
    expect(renderHook(() => useSearchPlaceholder()).result.current).toBe("곡명·아티스트 검색");
  });

  it("넓은 화면은 검색할 수 있는 글자 종류까지 적은 긴 문구를 쓴다", () => {
    mockWidth(true);
    expect(renderHook(() => useSearchPlaceholder()).result.current).toBe("곡명, 아티스트 검색 (한글·일본어·로마자)");
  });
});
