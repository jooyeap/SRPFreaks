import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SongJacket } from "@/components/SongJacket";

describe("SongJacket", () => {
  it("장식 칸이라 스크린리더에는 숨기고, 안에 얹은 요소를 그대로 보여 준다", () => {
    const { container } = render(
      <SongJacket className="h-10 w-10">
        <span>9.80</span>
      </SongJacket>,
    );
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toBe("9.80");
  });
});
