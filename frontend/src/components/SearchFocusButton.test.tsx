import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchFocusButton } from "@/components/SearchFocusButton";

describe("곡 검색 버튼 (넓은 화면에서 떠 있는 버튼, 화면 안 검색창으로 이동)", () => {
  it("떠 있는 버튼은 lg 이상에서만 보이고, 헤더에는 아이콘을 넣지 않는다 (D107: 헤더 검색은 GlobalSongSearch)", () => {
    render(
      <>
        <header data-testid="header" />
        <input id="search-target" aria-label="검색창" />
        <SearchFocusButton targetId="search-target" />
      </>,
    );
    const buttons = screen.getAllByRole("button", { name: "곡 검색" });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].className).toContain("hidden");
    expect(buttons[0].className).toContain("lg:flex");
    expect(screen.getByTestId("header")).toBeEmptyDOMElement();
  });

  it("누르면 검색창에 포커스가 간다", () => {
    render(
      <>
        <input id="search-target" aria-label="검색창" />
        <SearchFocusButton targetId="search-target" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "곡 검색" }));
    expect(screen.getByRole("textbox", { name: "검색창" })).toHaveFocus();
  });
});
