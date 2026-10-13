import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "@/components/Toast";

function Button({ text }: { text: string }) {
  const toast = useToast();
  return <button onClick={() => toast(text)}>알림</button>;
}

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("안내를 띄우고 몇 초 뒤 사라진다 (role=status)", () => {
    render(
      <ToastProvider>
        <Button text="기록을 저장했습니다." />
      </ToastProvider>,
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    expect(screen.getByRole("status")).toHaveTextContent("기록을 저장했습니다.");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("데스크톱(md 이상)에서는 오른쪽 아래, 모바일은 가운데이고 클릭을 막지 않는다", () => {
    render(
      <ToastProvider>
        <Button text="완료" />
      </ToastProvider>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveClass("justify-center", "md:justify-end", "pointer-events-none");
  });

  it("Provider 밖에서 불러도 오류 없이 아무 일도 하지 않는다", () => {
    render(<Button text="없음" />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "알림" }))).not.toThrow();
  });
});
