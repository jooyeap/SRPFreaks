import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageSizeSelect } from "@/components/PageSizeSelect";

describe("PageSizeSelect", () => {
  it("10 / 20 / 50개씩을 보여 주고 현재 값을 고른 상태로 둔다", () => {
    render(<PageSizeSelect value={20} onChange={() => {}} />);
    const select = screen.getByRole("combobox", { name: "한 번에 보이는 개수" });
    expect(select).toHaveValue("20");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["10개씩", "20개씩", "50개씩"]);
  });

  it("고르면 숫자로 알린다", () => {
    const onChange = vi.fn();
    render(<PageSizeSelect value={10} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it("선택지를 따로 줄 수 있다(감사 로그는 30 포함)", () => {
    render(<PageSizeSelect value={30} options={[10, 30, 50, 100]} onChange={() => {}} />);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["10개씩", "30개씩", "50개씩", "100개씩"]);
  });
});
