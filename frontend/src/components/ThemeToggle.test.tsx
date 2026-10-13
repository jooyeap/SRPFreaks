import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const root = () => document.documentElement;

describe("ThemeToggle", () => {
  it("다크에서 누르면 라이트로 바뀌고 선택을 저장한다", () => {
    root().setAttribute("data-theme", "dark");
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "다크/라이트 테마 전환" }));

    expect(root().getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("라이트에서 누르면 다크로 바뀐다", () => {
    root().setAttribute("data-theme", "light");
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button"));

    expect(root().getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("선택한 적이 없으면 기본(다크)에서 라이트로 바뀐다", () => {
    // jsdom에는 matchMedia가 없으므로 "시스템 설정을 알 수 없음 -> 다크"로 본다
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button"));

    expect(root().getAttribute("data-theme")).toBe("light");
  });

  it("저장소를 못 써도 이번 화면의 테마는 바뀐다", () => {
    root().setAttribute("data-theme", "dark");
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole("button"));
      expect(root().getAttribute("data-theme")).toBe("light");
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it("해·달 아이콘이 있는 스위치이고, 마크업은 테마와 상관없이 항상 같다 (하이드레이션 오류 방지)", () => {
    root().setAttribute("data-theme", "light");
    const { container, rerender } = render(<ThemeToggle />);
    const lightHtml = container.innerHTML;
    expect(container.querySelector(".theme-sun")).not.toBeNull();
    expect(container.querySelector(".theme-moon")).not.toBeNull();

    root().setAttribute("data-theme", "dark");
    rerender(<ThemeToggle />);
    expect(container.innerHTML).toBe(lightHtml);
  });

  it("글자 없는 아이콘 버튼이라 접근 가능한 이름(aria-label)으로 구분한다", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "다크/라이트 테마 전환" })).toBeInTheDocument();
  });
});
