import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AverageToggle, FilterChips, MultiFilterChips } from "@/components/table/FilterChips";

const PARTS = [
  { value: "GUITAR", label: "Guitar" },
  { value: "BASS", label: "Bass" },
] as const;

describe("FilterChips (세그먼트: 하나만 고르는 필터)", () => {
  it("전체와 옵션이 한 줄로 붙고, 켜진 칸만 aria-pressed다", () => {
    render(<FilterChips label="파트" options={PARTS} selected="BASS" onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "파트" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["전체", "Guitar", "Bass"]);
    expect(within(group).getByRole("button", { name: "Bass" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "false");
  });

  it("누른 값을 알리고, 전체는 null이다", () => {
    const onChange = vi.fn();
    render(<FilterChips label="파트" options={PARTS} selected="BASS" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Guitar" }));
    expect(onChange).toHaveBeenLastCalledWith("GUITAR");
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe("MultiFilterChips (체크 칩: 여러 개 고르는 필터)", () => {
  it("켜진 칩에는 ✓ 가 붙고(색만으로 구분하지 않는다), 아무것도 없으면 전체가 켜진다", () => {
    const { rerender } = render(
      <MultiFilterChips label="속성" options={[{ value: "단일", label: "단일" }, { value: "복합", label: "복합" }]} selected={[]} onToggle={() => {}} onClear={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "전체" })).toHaveTextContent("✓");

    rerender(
      <MultiFilterChips label="속성" options={[{ value: "단일", label: "단일" }, { value: "복합", label: "복합" }]} selected={["복합"]} onToggle={() => {}} onClear={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /복합/ })).toHaveTextContent("✓");
    expect(screen.getByRole("button", { name: "단일" })).not.toHaveTextContent("✓");
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "false");
  });

  it("옵션은 누를 때마다 토글을 알리고, 전체는 해제를 알린다", () => {
    const onToggle = vi.fn();
    const onClear = vi.fn();
    render(<MultiFilterChips label="속성" options={[{ value: "단일", label: "단일" }]} selected={["단일"]} onToggle={onToggle} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: /단일/ }));
    expect(onToggle).toHaveBeenCalledWith("단일");
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("AverageToggle", () => {
  it("기본은 0% 미포함이고, 누르면 포함 여부를 알린다", () => {
    const onChange = vi.fn();
    render(<AverageToggle includeZero={false} onChange={onChange} />);
    expect(screen.getByRole("group", { name: "평균 계산" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "0% 미포함" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "0% 포함" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
