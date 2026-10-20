import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorRetry } from "@/components/ErrorRetry";

describe("ErrorRetry", () => {
  it("문구를 alert로 보여 주고, 다시 시도를 누르면 onRetry를 부른다", () => {
    const onRetry = vi.fn();
    render(<ErrorRetry onRetry={onRetry}>네트워크 연결을 확인해 주세요.</ErrorRetry>);
    expect(screen.getByRole("alert")).toHaveTextContent("네트워크 연결을 확인해 주세요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("다시 시도 중에는 버튼을 잠가 같은 요청이 겹치지 않게 한다", () => {
    const onRetry = vi.fn();
    render(
      <ErrorRetry onRetry={onRetry} retrying>
        실패
      </ErrorRetry>,
    );
    const button = screen.getByRole("button", { name: "불러오는 중…" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
