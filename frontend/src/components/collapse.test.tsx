import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Collapse } from "@/components/Collapse";

function mockReduced(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} })),
  );
}

describe("Collapse (D82, 모션 PR 3)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("처음부터 열려 있으면 모션 없이 바로 펼친 상태다(스크롤 복원·진입에 영향 없음)", () => {
    mockReduced(false);
    render(<Collapse open id="b">{() => <p>내용</p>}</Collapse>);
    const box = document.getElementById("b")!;
    expect(box).toHaveAttribute("data-expanded", "true");
    expect(box).toHaveAttribute("data-clip", "false");
    expect(screen.getByText("내용")).toBeInTheDocument();
  });

  it("처음부터 닫혀 있으면 내용을 만들지 않고 숨긴다", () => {
    mockReduced(false);
    const children = vi.fn(() => <p>내용</p>);
    render(<Collapse open={false} id="b">{children}</Collapse>);
    expect(children).not.toHaveBeenCalled();
    expect(document.getElementById("b")).toHaveAttribute("hidden");
  });

  it("열면 0fr로 먼저 그린 뒤 다음 프레임에 펼치고, 끝나면 자르지 않는다", () => {
    mockReduced(false);
    const { rerender } = render(<Collapse open={false} id="b">{() => <p>내용</p>}</Collapse>);
    rerender(<Collapse open id="b">{() => <p>내용</p>}</Collapse>);
    const box = document.getElementById("b")!;
    expect(box).not.toHaveAttribute("hidden");
    expect(box).toHaveAttribute("data-expanded", "false");
    expect(box).toHaveAttribute("data-clip", "true");
    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(box).toHaveAttribute("data-expanded", "true");
    expect(box).toHaveAttribute("data-clip", "true");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(box).toHaveAttribute("data-clip", "false");
  });

  it("닫으면 모션이 끝날 때까지 내용을 남기고 그 뒤에 지운다", () => {
    mockReduced(false);
    const { rerender } = render(<Collapse open id="b">{() => <p>내용</p>}</Collapse>);
    rerender(<Collapse open={false} id="b">{() => <p>내용</p>}</Collapse>);
    const box = document.getElementById("b")!;
    expect(box).toHaveAttribute("data-expanded", "false");
    expect(screen.getByText("내용")).toBeInTheDocument();
    expect(box).toHaveAttribute("inert");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText("내용")).toBeNull();
    expect(box).toHaveAttribute("hidden");
  });

  it("움직임 줄이기면 열고 닫는 즉시 바뀐다", () => {
    mockReduced(true);
    const { rerender } = render(<Collapse open={false} id="b">{() => <p>내용</p>}</Collapse>);
    rerender(<Collapse open id="b">{() => <p>내용</p>}</Collapse>);
    expect(screen.getByText("내용")).toBeInTheDocument();
    expect(document.getElementById("b")).toHaveAttribute("data-expanded", "true");
    rerender(<Collapse open={false} id="b">{() => <p>내용</p>}</Collapse>);
    expect(screen.queryByText("내용")).toBeNull();
  });

  it("alwaysOnWide는 접혀 있어도 내용을 그리고 inert를 쓰지 않는다", () => {
    mockReduced(false);
    render(<Collapse open={false} id="b" alwaysOnWide>{() => <p>필터</p>}</Collapse>);
    expect(screen.getByText("필터")).toBeInTheDocument();
    expect(document.getElementById("b")).not.toHaveAttribute("inert");
  });
});
