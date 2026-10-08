import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { MobileMenu } from "@/components/MobileMenu";

function renderMenu() {
  return render(
    <AuthProvider>
      <MobileMenu />
    </AuthProvider>,
  );
}

const opener = () => screen.getByRole("button", { name: "메뉴 열기" });

describe("MobileMenu", () => {
  it("처음에는 메뉴가 닫혀 있고 햄버거 버튼만 보인다", () => {
    renderMenu();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener()).toHaveAttribute("aria-expanded", "false");
  });

  it("버튼을 누르면 슬라이드 메뉴가 열리고 주 메뉴 링크가 보인다", () => {
    renderMenu();
    fireEvent.click(opener());

    const dialog = screen.getByRole("dialog", { name: "메뉴" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const nav = within(dialog).getByRole("navigation", { name: "주요 메뉴(모바일)" });
    expect(within(nav).getByRole("link", { name: "곡 목록" })).toHaveAttribute("href", "/songs");
    expect(within(nav).getByRole("link", { name: "서열표" })).toHaveAttribute("href", "/table");
    expect(within(nav).getByRole("link", { name: "레이팅" })).toHaveAttribute("href", "/rating");
    expect(within(nav).getByRole("link", { name: "유저" })).toHaveAttribute("href", "/players");
  });

  it("열면 닫기 버튼으로 포커스가 가고, 뒤 화면 스크롤을 잠근다", () => {
    renderMenu();
    fireEvent.click(opener());

    expect(screen.getByRole("button", { name: "메뉴 닫기" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("닫기 버튼을 누르면 닫히고 스크롤 잠금이 풀리며 포커스가 햄버거로 돌아온다", () => {
    renderMenu();
    fireEvent.click(opener());
    fireEvent.click(screen.getByRole("button", { name: "메뉴 닫기" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(opener()).toHaveFocus();
  });

  it("Esc를 누르면 닫힌다", () => {
    renderMenu();
    fireEvent.click(opener());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener()).toHaveFocus();
  });

  it("바깥 어두운 영역을 누르면 닫힌다", () => {
    const { container } = renderMenu();
    fireEvent.click(opener());
    const overlay = container.ownerDocument.querySelector(".drawer-overlay");
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay as Element);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("메뉴 링크를 누르면 이동하면서 닫힌다", () => {
    renderMenu();
    fireEvent.click(opener());
    fireEvent.click(screen.getByRole("link", { name: "서열표" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Tab은 메뉴 안에서만 돈다 (끝에서 Tab -> 처음, 처음에서 Shift+Tab -> 끝)", () => {
    renderMenu();
    fireEvent.click(opener());
    const dialog = screen.getByRole("dialog");
    // DOM 순서대로 첫/끝 요소를 구한다 (닫기 버튼이 맨 앞, 메뉴 링크들이 그 뒤)
    const items = Array.from(dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
    const first = items[0];
    const last = items[items.length - 1];
    expect(first).toBe(screen.getByRole("button", { name: "메뉴 닫기" }));

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });
});
