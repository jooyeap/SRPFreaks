import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchFocusButton } from "@/components/SearchFocusButton";
import { HEADER_SEARCH_SLOT_ID } from "@/lib/header-slots";

/** 헤더의 빈 자리 + 검색창 + 버튼. 실제로는 SiteHeader가 자리를, 서열표·곡 목록이 검색창과 버튼을 그린다 */
function renderWithHeader() {
  return render(
    <>
      <header>
        <span id={HEADER_SEARCH_SLOT_ID} data-testid="slot" />
      </header>
      <input id="search-target" aria-label="검색창" />
      <SearchFocusButton targetId="search-target" />
    </>,
  );
}

describe("곡 검색 버튼 (모바일은 헤더 아이콘, 넓은 화면은 떠 있는 버튼)", () => {
  it("헤더 자리가 있으면 같은 동작의 아이콘을 헤더에 넣고, 떠 있는 버튼은 lg 이상에서만 보이게 한다", async () => {
    renderWithHeader();
    const slot = screen.getByTestId("slot");
    await waitFor(() => expect(within(slot).getByRole("button", { name: "곡 검색" })).toBeInTheDocument());
    const floating = screen.getAllByRole("button", { name: "곡 검색" }).find((b) => !slot.contains(b));
    expect(floating?.className).toContain("hidden");
    expect(floating?.className).toContain("lg:flex");
  });

  it("헤더 아이콘을 누르면 검색창에 포커스가 간다", async () => {
    renderWithHeader();
    const slot = screen.getByTestId("slot");
    const headerButton = await within(slot).findByRole("button", { name: "곡 검색" });
    fireEvent.click(headerButton);
    expect(screen.getByRole("textbox", { name: "검색창" })).toHaveFocus();
  });

  it("헤더 자리가 없는 화면에서는 떠 있는 버튼만 그린다", () => {
    render(
      <>
        <input id="search-target" aria-label="검색창" />
        <SearchFocusButton targetId="search-target" />
      </>,
    );
    expect(screen.getAllByRole("button", { name: "곡 검색" })).toHaveLength(1);
  });
});
