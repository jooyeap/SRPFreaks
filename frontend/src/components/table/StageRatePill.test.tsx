import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageRatePill } from "@/components/table/StageRatePill";

// D104: 알약 줄 높이(18px)와 달성률 칸 줄 높이가 같아야 숫자가 위로 쏠리지 않는다.
describe("StageRatePill 세로 맞춤", () => {
  it("랭크 칸과 달성률 칸 모두 줄 높이 18px", () => {
    render(<StageRatePill stage="S" rate={92.93} />);
    expect(screen.getByLabelText("달성 단계 S")).toHaveClass("leading-[18px]");
    expect(screen.getByText("92.93")).toHaveClass("leading-[18px]");
  });

  it("align=end도 같은 줄 높이를 쓰고 오른쪽 정렬·여백은 그대로", () => {
    render(<StageRatePill stage="SS" rate={96} align="end" />);
    const rate = screen.getByText("96.00");
    expect(rate).toHaveClass("leading-[18px]", "pr-1", "text-right");
    expect(screen.getByLabelText("달성 단계 SS")).toHaveClass("leading-[18px]");
  });

  it("기록이 없을 때 빈 표시 두 칸도 줄 높이 18px", () => {
    const { container } = render(<StageRatePill stage={null} rate={null} />);
    const cells = Array.from(container.firstElementChild!.children).filter((c) => c.textContent === "–");
    expect(cells).toHaveLength(2);
    cells.forEach((c) => expect(c).toHaveClass("leading-[18px]"));
  });
});
