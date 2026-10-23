import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readOpenKeys, resetOpenKeysForTest, useOpenKeys, writeOpenKeys } from "@/lib/open-keys";

describe("펼친 폴더 기억 (open-keys)", () => {
  it("처음에는 모두 닫혀 있고, 쓴 값은 다시 읽힌다", () => {
    expect(readOpenKeys("table").size).toBe(0);
    writeOpenKeys("table", new Set(["5.8", "undecided"]));
    expect([...readOpenKeys("table")].sort()).toEqual(["5.8", "undecided"]);
  });

  it("화면 이동으로 메모리가 사라져도 같은 탭의 sessionStorage에서 되살린다", () => {
    writeOpenKeys("songs", new Set(["0.50:9.50"]));
    resetOpenKeysForTest(); // 새로고침처럼 메모리만 비운다
    expect([...readOpenKeys("songs")]).toEqual(["0.50:9.50"]);
  });

  it("table과 songs는 서로 섞이지 않는다", () => {
    writeOpenKeys("table", new Set(["5.8"]));
    expect(readOpenKeys("songs").size).toBe(0);
  });

  it("저장된 값이 문자열 배열이 아니거나 깨져 있으면 모두 닫힌 상태로 시작한다", () => {
    sessionStorage.setItem("srp.open.table", JSON.stringify([1, 2]));
    expect(readOpenKeys("table").size).toBe(0);
    resetOpenKeysForTest();
    sessionStorage.setItem("srp.open.table", "{깨진 값");
    expect(readOpenKeys("table").size).toBe(0);
  });

  it("너무 많은 값(500개 초과)은 버린다", () => {
    sessionStorage.setItem("srp.open.table", JSON.stringify(Array.from({ length: 501 }, (_, i) => String(i))));
    expect(readOpenKeys("table").size).toBe(0);
  });

  it("저장소를 못 써도(예외) 메모리 값으로 동작한다", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => writeOpenKeys("table", new Set(["5.8"]))).not.toThrow();
    expect([...readOpenKeys("table")]).toEqual(["5.8"]);
    setItem.mockRestore();
  });

  it("useOpenKeys: 열고 닫고 모두 바꾸면 저장도 함께 바뀐다", () => {
    const { result } = renderHook(() => useOpenKeys("table"));
    act(() => result.current.setOpen("5.8", true));
    expect(result.current.keys.has("5.8")).toBe(true);
    expect([...readOpenKeys("table")]).toEqual(["5.8"]);

    act(() => result.current.setOpen("5.8", false));
    expect(result.current.keys.size).toBe(0);

    act(() => result.current.replaceAll(["5.6", "5.7"]));
    expect([...readOpenKeys("table")].sort()).toEqual(["5.6", "5.7"]);
  });
});
