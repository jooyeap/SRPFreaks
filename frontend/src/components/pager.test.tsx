import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pager, usePaged } from "@/components/Pager";

describe("usePaged", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it("지정한 크기로 자르고 전체 페이지 수를 계산한다", () => {
    const { result } = renderHook(() => usePaged(items, 10));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.pageItems).toEqual(items.slice(0, 10));
    act(() => result.current.setPage(2));
    expect(result.current.pageItems).toEqual([20, 21, 22, 23, 24]);
  });

  it("목록이 짧아져 현재 페이지가 범위를 넘으면 마지막 페이지로 당긴다", () => {
    const { result, rerender } = renderHook(({ list }) => usePaged(list, 10), { initialProps: { list: items } });
    act(() => result.current.setPage(2));
    rerender({ list: items.slice(0, 12) });
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toEqual([10, 11]);
  });

  it("빈 목록도 1페이지로 본다", () => {
    const { result } = renderHook(() => usePaged([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageItems).toEqual([]);
  });
});

describe("Pager", () => {
  it("한 페이지뿐이면 아무것도 그리지 않는다", () => {
    const { container } = render(<Pager page={0} totalPages={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("처음에는 이전이, 마지막에는 다음이 꺼지고 누르면 페이지를 알린다", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Pager page={0} totalPages={3} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(onChange).toHaveBeenCalledWith(1);
    rerender(<Pager page={2} totalPages={3} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });
});
