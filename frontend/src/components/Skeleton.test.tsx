import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "@/components/Skeleton";

describe("Skeleton", () => {
  it("자리를 잡는 칸이고 화면 읽기용 안내 글자를 가진다", () => {
    const { container } = render(<Skeleton label="레이팅을 불러오는 중입니다." className="h-40" />);
    expect(screen.getByText("레이팅을 불러오는 중입니다.")).toHaveClass("sr-only");
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(container.firstElementChild).toHaveClass("h-40");
  });
});
