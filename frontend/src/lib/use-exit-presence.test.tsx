import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXIT_MS, useExitPresence, useHeldWhileOpen } from "@/lib/use-exit-presence";

function mockReduced(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} })),
  );
}

function Probe({ open, onRequestClose }: { open: boolean; onRequestClose?: () => void }) {
  const exit = useExitPresence(open, { onRequestClose });
  return exit.present ? (
    <dialog open data-testid="d" {...exit.dialogProps}>
      내용
    </dialog>
  ) : null;
}

describe("useExitPresence (D82, 모션 PR 4)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("닫으면 닫히는 모션 동안 data-closing으로 남았다가 끝나면 DOM에서 사라진다", () => {
    mockReduced(false);
    const { rerender } = render(<Probe open />);
    expect(screen.getByTestId("d")).not.toHaveAttribute("data-closing");
    rerender(<Probe open={false} />);
    // 닫힌 바로 그 렌더에서도 요소가 남아 깜빡이지 않는다
    expect(screen.getByTestId("d")).toHaveAttribute("data-closing", "true");
    act(() => {
      vi.advanceTimersByTime(EXIT_MS - 1);
    });
    expect(screen.queryByTestId("d")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(screen.queryByTestId("d")).toBeNull();
  });

  it("움직임 줄이기에서는 바로 사라진다", () => {
    mockReduced(true);
    const { rerender } = render(<Probe open />);
    rerender(<Probe open={false} />);
    expect(screen.queryByTestId("d")).toBeNull();
  });

  it("처음부터 닫혀 있으면 아무것도 그리지 않는다", () => {
    mockReduced(false);
    render(<Probe open={false} />);
    expect(screen.queryByTestId("d")).toBeNull();
  });

  it("닫는 중에 다시 열면 닫는 표시가 사라지고 타이머가 취소되어 계속 남아 있다", () => {
    mockReduced(false);
    const { rerender } = render(<Probe open />);
    rerender(<Probe open={false} />);
    act(() => {
      vi.advanceTimersByTime(60);
    });
    rerender(<Probe open />);
    expect(screen.getByTestId("d")).not.toHaveAttribute("data-closing");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId("d")).not.toBeNull();
  });

  it("Esc(cancel)는 기본 동작(바로 닫기)을 막고 닫기 요청을 한 번만 한다. 이미 닫는 중이면 무시한다", () => {
    mockReduced(false);
    const request = vi.fn();
    const { rerender } = render(<Probe open onRequestClose={request} />);
    const cancel = new Event("cancel", { cancelable: true });
    act(() => {
      screen.getByTestId("d").dispatchEvent(cancel);
    });
    expect(cancel.defaultPrevented).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    // 부모가 open을 false로 바꾸면 닫는 중이 된다. 이때 또 Esc가 와도 두 번 닫지 않는다
    rerender(<Probe open={false} onRequestClose={request} />);
    const again = new Event("cancel", { cancelable: true });
    act(() => {
      screen.getByTestId("d").dispatchEvent(again);
    });
    expect(again.defaultPrevented).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("useHeldWhileOpen", () => {
  function Held({ open, label }: { open: boolean; label: string }) {
    // 매 렌더 새 객체를 줘도 값이 같으면 다시 저장하지 않는다(무한 렌더가 되지 않는다)
    const held = useHeldWhileOpen(open, { label });
    return <p data-testid="p">{held.label}</p>;
  }

  it("열려 있으면 지금 값, 닫히면 마지막으로 열려 있던 때의 값을 돌려준다", () => {
    const { rerender } = render(<Held open label="삭제" />);
    expect(screen.getByTestId("p")).toHaveTextContent("삭제");
    rerender(<Held open label="수정" />);
    expect(screen.getByTestId("p")).toHaveTextContent("수정");
    rerender(<Held open={false} label="" />);
    expect(screen.getByTestId("p")).toHaveTextContent("수정");
  });
});
