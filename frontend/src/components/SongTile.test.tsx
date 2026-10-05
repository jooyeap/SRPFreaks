import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SongTile } from "@/components/SongTile";

describe("SongTile", () => {
  it("같은 곡 ID는 같은 색 쌍과 무늬를 가진다", () => {
    const a = render(<SongTile songId={5} />).container.firstElementChild;
    const b = render(<SongTile songId={5} />).container.firstElementChild;
    expect(a?.getAttribute("data-palette")).toBe(b?.getAttribute("data-palette"));
    expect(a?.getAttribute("data-pattern")).toBe(b?.getAttribute("data-pattern"));
  });

  it("장식이라서 스크린리더에는 숨기고, 제목을 주면 첫 글자를 얹는다", () => {
    const { container } = render(<SongTile songId={5} title="midnight" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toBe("M");
  });

  it("제목이 없으면 글자를 얹지 않는다", () => {
    const { container } = render(<SongTile songId={5} />);
    expect(container.textContent).toBe("");
  });
});
