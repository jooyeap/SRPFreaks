import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollTopButton } from "@/components/ScrollTopButton";

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("ScrollTopButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    scrollTo(0);
  });

  it("맨 위 근처에서는 보이지 않고, 600px 넘게 내려오면 나타난다", () => {
    render(<ScrollTopButton />);
    expect(screen.queryByRole("button", { name: "맨 위로" })).toBeNull();
    scrollTo(700);
    expect(screen.getByRole("button", { name: "맨 위로" })).toBeInTheDocument();
    scrollTo(100);
    expect(screen.queryByRole("button", { name: "맨 위로" })).toBeNull();
  });

  it("누르면 화면을 맨 위로 올린다", () => {
    const spy = vi.fn();
    vi.stubGlobal("scrollTo", spy);
    render(<ScrollTopButton />);
    scrollTo(900);
    fireEvent.click(screen.getByRole("button", { name: "맨 위로" }));
    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    vi.unstubAllGlobals();
  });

  it("모바일 목록 맨 아래에 버튼 높이만큼 빈칸을 남긴다(마지막 줄이 가려지지 않게), 버튼이 안 보일 때도 남는다", () => {
    const { container } = render(<ScrollTopButton />);
    const spacer = container.querySelector('div[aria-hidden="true"]');
    expect(spacer).not.toBeNull();
    expect(spacer?.className).toContain("lg:hidden");
  });
});
