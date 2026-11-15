import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import ko from "../../messages/ko.json";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HelpTip } from "@/components/HelpTip";
import { ToastProvider, useToast } from "@/components/Toast";

// 닫힘 모션(D82, 모션 PR 4): 움직임을 켠 환경(움직임 줄이기 꺼짐)에서 창·말풍선·토스트가 닫히는 동안 남았다가 사라지고,
// 닫히는 중에는 두 번 닫히지 않으며, 움직임 줄이기에서는 바로 사라진다.
function mockReduced(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} })),
  );
}

function withIntl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="ko" messages={ko}>
      {node}
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ConfirmDialog 닫힘", () => {
  function Harness({ open, onCancel }: { open: boolean; onCancel: () => void }) {
    return withIntl(
      <ConfirmDialog open={open} title={open ? "삭제할까요?" : ""} message={open ? "되돌릴 수 없습니다." : ""} confirmLabel="삭제" onConfirm={() => {}} onCancel={onCancel} />,
    );
  }

  it("닫으면 열려 있던 문구 그대로 나가는 모션 동안 남고, 끝나면 DOM에서 사라진다", () => {
    mockReduced(false);
    const { rerender } = render(<Harness open onCancel={() => {}} />);
    rerender(<Harness open={false} onCancel={() => {}} />);
    const dialog = document.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAttribute("data-closing", "true");
    // 부모가 문구를 비웠어도 나가는 동안은 그대로다
    expect(dialog).toHaveTextContent("삭제할까요?");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("움직임 줄이기에서는 바로 사라진다", () => {
    mockReduced(true);
    const { rerender } = render(<Harness open onCancel={() => {}} />);
    rerender(<Harness open={false} onCancel={() => {}} />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("Esc(cancel)는 브라우저가 창을 바로 닫지 못하게 막고 onCancel을 한 번만 부른다", () => {
    mockReduced(false);
    const onCancel = vi.fn();
    render(<Harness open onCancel={onCancel} />);
    const dialog = document.querySelector("dialog")!;
    const cancel = new Event("cancel", { cancelable: true });
    act(() => {
      dialog.dispatchEvent(cancel);
    });
    expect(cancel.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("HelpTip 닫힘", () => {
  it("열 때 motion-reveal, 닫는 동안 data-closing으로 남았다가 사라지고 포커스는 버튼으로 돌아온다", () => {
    mockReduced(false);
    render(withIntl(<HelpTip title="제목" body="본문" ariaLabel="설명 보기" />));
    const button = screen.getByRole("button", { name: "설명 보기" });
    fireEvent.click(button);
    const panel = screen.getByRole("dialog", { name: "제목" });
    expect(panel).toHaveClass("motion-reveal");
    expect(panel).not.toHaveAttribute("data-closing");

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("dialog", { name: "제목" })).toHaveAttribute("data-closing", "true");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("움직임 줄이기에서는 바로 사라진다", () => {
    mockReduced(true);
    render(withIntl(<HelpTip title="제목" body="본문" ariaLabel="설명 보기" />));
    const button = screen.getByRole("button", { name: "설명 보기" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Toast 나가는 모션", () => {
  function Button({ withAction }: { withAction?: () => void }) {
    const toast = useToast();
    return (
      <button onClick={() => toast("저장했습니다.", withAction ? { action: { label: "되돌리기", onAction: withAction } } : undefined)}>알림</button>
    );
  }

  it("시간이 지나면 data-closing으로 120ms 남았다가 사라진다", () => {
    mockReduced(false);
    render(
      <ToastProvider>
        <Button />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    const status = screen.getByRole("status");
    expect(status.querySelector("[data-closing]")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2800);
    });
    expect(status.querySelector("[data-closing='true']")).not.toBeNull();
    expect(status).toHaveTextContent("저장했습니다.");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(status).toBeEmptyDOMElement();
  });

  it("동작 버튼은 닫히는 중에 다시 눌러도 한 번만 동작한다", () => {
    mockReduced(false);
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Button withAction={onAction} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    const undo = screen.getByRole("button", { name: "되돌리기" });
    fireEvent.click(undo);
    fireEvent.click(undo);
    expect(onAction).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("새 안내가 오면 이전 안내는 모션 없이 바로 대체된다", () => {
    mockReduced(false);
    render(
      <ToastProvider>
        <Button />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    expect(screen.getByRole("status").querySelectorAll("p")).toHaveLength(1);
    expect(screen.getByRole("status").querySelector("[data-closing]")).toBeNull();
  });

  it("움직임 줄이기에서는 바로 사라진다", () => {
    mockReduced(true);
    render(
      <ToastProvider>
        <Button />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    act(() => {
      vi.advanceTimersByTime(2800);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
