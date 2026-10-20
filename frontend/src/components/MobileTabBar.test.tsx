import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "@/components/MobileTabBar";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("MobileTabBar", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it("홈 · 곡 · 마이 링크와 더보기 버튼이 순서대로 있다", () => {
    render(<MobileTabBar />);
    const nav = screen.getByRole("navigation", { name: "하단 메뉴" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/table", "/me"]);
    expect(links.map((link) => link.textContent)).toEqual(["홈", "곡", "마이"]);
    expect(within(nav).getByRole("link", { name: "마이페이지" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "더보기" })).toHaveAttribute("aria-expanded", "false");
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

  it("서열표 화면에서 곡 탭만 aria-current와 굵은 글자로 강조한다", () => {
    pathname = "/table/6.7";
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "곡" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "곡" })).toHaveClass("font-bold");
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
  });

  it("곡 목록·곡 상세 화면에서도 곡 탭이 강조된다", () => {
    pathname = "/songs/12";
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "곡" })).toHaveAttribute("aria-current", "page");
  });

  it("홈 탭은 홈에서만 강조된다", () => {
    pathname = "/songs";
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
  });

  it("더보기를 누르면 시트가 열리고 가져오기·공지·유저·건의·설명서·설정 링크가 보인다", () => {
    render(<MobileTabBar />);
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "더보기" }));

    const sheet = screen.getByRole("region", { name: "더보기" });
    const links = within(sheet).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/import",
      "/notices",
      "/players",
      "/suggestions",
      "/guide",
      "/settings",
    ]);
    expect(within(sheet).getByText("추천")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "더보기" })).toHaveAttribute("aria-expanded", "true");
  });

  it("시트는 Esc, 바깥 누르기, 링크 누르기, 더보기 다시 누르기로 닫힌다", () => {
    const { container } = render(<MobileTabBar />);
    const more = () => screen.getByRole("button", { name: "더보기" });

    fireEvent.click(more());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();

    fireEvent.click(more());
    fireEvent.click(container.querySelector("[aria-hidden='true'].bg-black\\/55") as Element);
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();

    fireEvent.click(more());
    fireEvent.click(screen.getByRole("link", { name: "공지" }));
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();

    fireEvent.click(more());
    fireEvent.click(more());
    expect(screen.queryByRole("region", { name: "더보기" })).toBeNull();
  });
});
