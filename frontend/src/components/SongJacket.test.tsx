import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SongJacket } from "@/components/SongJacket";
import { resetJacketSeen } from "@/lib/jacket-seen";

describe("SongJacket", () => {
  beforeEach(() => resetJacketSeen());

  it("장식 칸이라 스크린리더에는 숨기고, 안에 얹은 요소를 그대로 보여 준다", () => {
    const { container } = render(
      <SongJacket className="h-10 w-10">
        <span>9.80</span>
      </SongJacket>,
    );
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toBe("9.80");
  });

  it("이미지는 불러오기 전 투명이고 load 뒤 보이는 상태가 된다(단색 칸은 그대로 아래에 있다, D82 모션 PR 6)", () => {
    const { container } = render(<SongJacket url="/jackets/a.webp" title="곡" className="h-10 w-10" />);
    const img = container.querySelector("img");
    expect(img).toHaveClass("motion-jacket");
    expect(img).toHaveAttribute("data-loaded", "false");
    expect(container.firstElementChild).toHaveClass("bg-jacket");
    fireEvent.load(img as HTMLImageElement);
    expect(img).toHaveAttribute("data-loaded", "true");
  });

  it("이미 본 주소는 다시 그려도 처음부터 보이는 상태다(다시 나타나지 않는다)", () => {
    const first = render(<SongJacket url="/jackets/b.webp" title="곡" className="h-10 w-10" />);
    fireEvent.load(first.container.querySelector("img") as HTMLImageElement);
    first.unmount();
    const again = render(<SongJacket url="/jackets/b.webp" title="곡" className="h-10 w-10" />);
    expect(again.container.querySelector("img")).toHaveAttribute("data-loaded", "true");
  });

  it("badge가 있는 구조에서도 같다", () => {
    const { container } = render(<SongJacket url="/jackets/c.webp" title="곡" className="h-10 w-10" badge={<span>단일</span>} />);
    expect(container.querySelector("img")).toHaveAttribute("data-loaded", "false");
  });

  it("주소가 없으면 이미지 없이 단색 칸만 그린다", () => {
    const { container } = render(<SongJacket className="h-10 w-10" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
