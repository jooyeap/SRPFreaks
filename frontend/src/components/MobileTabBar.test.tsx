import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "@/components/MobileTabBar";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("MobileTabBar", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it("홈 · 곡 · 서열표 · 마이 네 탭이 순서대로 있고 링크가 맞다", () => {
    render(<MobileTabBar />);
    const nav = screen.getByRole("navigation", { name: "하단 메뉴" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/songs", "/table", "/me"]);
    // 보이는 글자는 짧게(곡, 마이), 화면 읽기 프로그램 이름은 전체 이름이다
    expect(links.map((link) => link.textContent)).toEqual(["홈", "곡", "서열표", "마이"]);
    expect(within(nav).getByRole("link", { name: "곡 목록" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "마이페이지" })).toBeInTheDocument();
  });

  it("lg 이상에서는 숨기고(lg:hidden) 화면 아래에 고정된다", () => {
    render(<MobileTabBar />);
    const nav = screen.getByRole("navigation", { name: "하단 메뉴" });
    expect(nav).toHaveClass("fixed", "bottom-0", "lg:hidden");
  });

  it("아이콘은 장식이라 화면 읽기 프로그램에 숨긴다", () => {
    render(<MobileTabBar />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("현재 화면 탭만 aria-current와 굵은 글자로 강조한다", () => {
    pathname = "/table/6.7";
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "서열표" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "서열표" })).toHaveClass("font-bold");
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "곡 목록" })).not.toHaveAttribute("aria-current");
  });

  it("홈 탭은 홈에서만 강조된다 (다른 화면에서는 꺼진다)", () => {
    pathname = "/songs";
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "곡 목록" })).toHaveAttribute("aria-current", "page");
  });
});
