import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartBadge } from "@/components/table/Badges";

describe("ChartBadge", () => {
  it("왼쪽에 파트, 오른쪽에 난이도와 레벨(둘째 자리까지)을 한 알약으로 보여 준다", () => {
    const { container } = render(<ChartBadge part="GUITAR" difficulty="MASTER" level={9.8} />);

    expect(screen.getByText("Guitar")).toHaveClass("chart-chip-part");
    expect(screen.getByText("MAS 9.80")).toHaveClass("chart-chip-diff");
    // 한 덩어리: 바깥 span 하나가 두 칸을 모두 감싼다
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toContainElement(screen.getByText("Guitar"));
    expect(container.firstElementChild).toContainElement(screen.getByText("MAS 9.80"));
  });

  it("난이도 색은 data-difficulty로 정하고, 파트는 글자(Guitar/Bass)로 구분한다", () => {
    const { container, rerender } = render(<ChartBadge part="BASS" difficulty="EXTREME" level={7.2} />);
    expect(container.firstElementChild).toHaveAttribute("data-difficulty", "EXTREME");
    expect(screen.getByText("Bass")).toBeInTheDocument();
    expect(screen.getByText("EXT 7.20")).toBeInTheDocument();

    rerender(<ChartBadge part="GUITAR" difficulty="BASIC" level={5} />);
    expect(container.firstElementChild).toHaveAttribute("data-difficulty", "BASIC");
    expect(screen.getByText("BAS 5.00")).toBeInTheDocument();
  });
});
