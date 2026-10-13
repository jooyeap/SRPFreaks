import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TierFolderNav } from "@/components/table/TierFolderNav";
import type { TierGroupResponse } from "@/lib/api-types";

function group(over: Partial<TierGroupResponse>): TierGroupResponse {
  return { tier: 5.8, total: 10, recorded: 4, exc: 0, fc: 0, ss: 0, s: 0, belowS: 4, averageRecorded: 80, averageWithZero: 32, entries: [], ...over };
}

// 서버 순서: 높은 난이도 먼저
const groups = [group({ tier: 5.9 }), group({ tier: 5.8, total: 12, recorded: 3 }), group({ tier: 5.7, total: 3, recorded: 3 })];

describe("TierFolderNav", () => {
  it("지금 난이도와 기록 수를 보이고, 왼쪽은 낮은 난이도 · 오른쪽은 높은 난이도로 가는 링크다", () => {
    render(<TierFolderNav groups={groups} currentTier={5.8} />);
    const bar = screen.getByRole("navigation", { name: "이웃 난이도" });
    expect(within(bar).getByText("5.8")).toHaveAttribute("aria-current", "page");
    expect(bar).toHaveTextContent("기록 3/12");
    const prev = within(bar).getByRole("link", { name: "이전 난이도 5.7" });
    const next = within(bar).getByRole("link", { name: "다음 난이도 5.9" });
    expect(prev).toHaveAttribute("href", "/table/folder/5.7");
    expect(next).toHaveAttribute("href", "/table/folder/5.9");
    expect(bar.firstElementChild).toBe(prev); // 왼쪽이 낮은 난이도
  });

  it("가장 낮은/높은 난이도에서는 갈 곳이 없는 쪽 링크가 없다", () => {
    const { rerender } = render(<TierFolderNav groups={groups} currentTier={5.7} />);
    expect(screen.queryByRole("link", { name: /이전 난이도/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다음 난이도 5.8" })).toBeInTheDocument();
    rerender(<TierFolderNav groups={groups} currentTier={5.9} />);
    expect(screen.queryByRole("link", { name: /다음 난이도/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이전 난이도 5.8" })).toBeInTheDocument();
  });

  it("칩 띠는 낮은 난이도부터 모든 난이도를 보이고 지금 것에 aria-current를 준다", () => {
    render(<TierFolderNav groups={groups} currentTier={5.8} />);
    const strip = screen.getByRole("navigation", { name: "난이도 목록" });
    const links = within(strip).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/table/folder/5.7", "/table/folder/5.8", "/table/folder/5.9"]);
    expect(links[0]).toHaveTextContent("3/3");
    expect(links.filter((l) => l.getAttribute("aria-current") === "page")).toEqual([links[1]]);
  });

  it("전부 기록한 난이도만 완료 색(data-done)이 붙는다", () => {
    render(<TierFolderNav groups={groups} currentTier={5.8} />);
    const items = within(screen.getByRole("navigation", { name: "난이도 목록" })).getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("data-done", "true"); // 5.7 = 3/3
    expect(items[1]).not.toHaveAttribute("data-done");
  });

  it("없는 난이도면 아무것도 그리지 않는다", () => {
    const { container } = render(<TierFolderNav groups={groups} currentTier={7.7} />);
    expect(container).toBeEmptyDOMElement();
  });
});
