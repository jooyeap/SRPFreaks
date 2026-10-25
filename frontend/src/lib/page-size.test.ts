import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { readPageSize, resetPageSizeForTest, usePageSize, writePageSize } from "@/lib/page-size";

describe("목록 개수 기억 (page-size)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetPageSizeForTest();
  });

  it("고른 적이 없으면 기본값을 쓴다", () => {
    expect(readPageSize("players", 20, [10, 20, 50])).toBe(20);
  });

  it("쓴 값은 다시 읽히고, 메모리가 비어도 같은 탭의 sessionStorage에서 되살린다", () => {
    writePageSize("notices", 50);
    expect(readPageSize("notices", 10, [10, 20, 50])).toBe(50);
    resetPageSizeForTest(); // 새로고침처럼 메모리만 비운다
    expect(readPageSize("notices", 10, [10, 20, 50])).toBe(50);
  });

  it("목록마다 따로 기억한다", () => {
    writePageSize("players", 50);
    expect(readPageSize("notices", 10, [10, 20, 50])).toBe(10);
  });

  it("허용 값 밖이거나 깨진 값이면 기본값으로 돌아간다 (서버 최대값을 넘기지 못한다)", () => {
    sessionStorage.setItem("srp.pagesize.players", "9999");
    expect(readPageSize("players", 20, [10, 20, 50])).toBe(20);
    resetPageSizeForTest();
    sessionStorage.setItem("srp.pagesize.players", "열 개");
    expect(readPageSize("players", 20, [10, 20, 50])).toBe(20);
  });

  it("훅은 기본값으로 시작하고, 바꾸면 같은 목록을 쓰는 모든 곳이 함께 바뀐다", () => {
    const a = renderHook(() => usePageSize("songs", 20));
    const b = renderHook(() => usePageSize("songs", 20));
    expect(a.result.current[0]).toBe(20);
    act(() => a.result.current[1](50));
    expect(a.result.current[0]).toBe(50);
    expect(b.result.current[0]).toBe(50); // 곡 목록 맨 위 선택과 폴더가 같은 값을 읽는다
  });

  it("허용 값이 아닌 개수로는 바꾸지 않는다", () => {
    const hook = renderHook(() => usePageSize("songs", 20));
    act(() => hook.result.current[1](7));
    expect(hook.result.current[0]).toBe(20);
  });
});
