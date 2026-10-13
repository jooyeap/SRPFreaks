import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TierQuickNav } from "@/components/table/TierQuickNav";
import type { TierGroupResponse } from "@/lib/api-types";

function group(over: Partial<TierGroupResponse>): TierGroupResponse {
  return { tier: 5.8, total: 10, recorded: 4, exc: 0, fc: 0, ss: 0, s: 0, belowS: 4, averageRecorded: 80, averageWithZero: 32, entries: [], ...over };
}

const opener = () => screen.getByRole("button", { name: /난이도 이동/ });

describe("TierQuickNav", () => {
  it("처음에는 버튼 하나만 보이고 난이도 목록은 닫혀 있다", () => {
    render(<TierQuickNav groups={[group({ tier: 6.8 }), group({ tier: 5.8 })]} />);
    expect(opener()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "난이도 바로가기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("버튼을 누르면 난이도마다 묶음 페이지로 가는 링크와 기록 수/전체가 나온다 (서열표 순서 그대로, 미정 포함)", () => {
    render(<TierQuickNav groups={[group({ tier: 6.8, total: 3, recorded: 1 }), group({ tier: 5.8 }), group({ tier: null, total: 2, recorded: 0 })]} />);
    fireEvent.click(opener());

    expect(opener()).toHaveAttribute("aria-expanded", "true");
    const links = within(screen.getByRole("navigation", { name: "난이도 바로가기" })).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/table/folder/6.8", "/table/folder/5.8", "/table/folder/undecided"]);
    expect(links[0]).toHaveTextContent("6.8");
    expect(links[0]).toHaveTextContent("1/3");
    expect(links[2]).toHaveTextContent("미정");
  });

  it("전부 기록한 난이도만 완료 색(data-done)이 붙고, 완료 글자는 쓰지 않는다", () => {
    render(<TierQuickNav groups={[group({ tier: 5.0, total: 3, recorded: 3 }), group({ tier: 5.8 }), group({ tier: null, total: 0, recorded: 0 })]} />);
    fireEvent.click(opener());
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("data-done", "true");
    expect(items[0].querySelector(".text-done-text")).not.toBeNull();
    expect(items[1]).not.toHaveAttribute("data-done");
    expect(items[2]).not.toHaveAttribute("data-done"); // 전체가 0이면 완료가 아니다
    expect(screen.getByRole("navigation")).not.toHaveTextContent("완료");
  });

  it("Esc를 누르면 닫히고 포커스가 버튼으로 돌아온다", () => {
    render(<TierQuickNav groups={[group({})]} />);
    fireEvent.click(opener());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("navigation", { name: "난이도 바로가기" })).not.toBeInTheDocument();
    expect(opener()).toHaveFocus();
  });

  it("바깥을 누르면 닫히고, 안쪽을 눌러서는 닫히지 않는다", () => {
    render(
      <div>
        <p>바깥 글자</p>
        <TierQuickNav groups={[group({})]} />
      </div>,
    );
    fireEvent.click(opener());
    fireEvent.mouseDown(screen.getByRole("navigation", { name: "난이도 바로가기" }));
    expect(screen.getByRole("navigation", { name: "난이도 바로가기" })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("바깥 글자"));
    expect(screen.queryByRole("navigation", { name: "난이도 바로가기" })).not.toBeInTheDocument();
  });

  it("난이도를 누르면 이동하면서 닫힌다", () => {
    render(<TierQuickNav groups={[group({ tier: 6.8 })]} />);
    fireEvent.click(opener());
    fireEvent.click(screen.getByRole("link", { name: /6\.8/ }));
    expect(screen.queryByRole("navigation", { name: "난이도 바로가기" })).not.toBeInTheDocument();
  });

  it("묶음이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<TierQuickNav groups={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
