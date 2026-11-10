import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TierFolderNav } from "@/components/table/TierFolderNav";
import type { TierGroupResponse } from "@/lib/api-types";

function group(over: Partial<TierGroupResponse>): TierGroupResponse {
  return { tier: 5.8, total: 10, recorded: 4, exc: 0, fc: 0, ss: 0, s: 0, belowS: 4, averageRecorded: 80, averageWithZero: 32, entries: [], ...over };
}

// 서버 순서: 높은 난이도 먼저
const groups = [group({ tier: 5.9 }), group({ tier: 5.8, total: 12, recorded: 3 }), group({ tier: 5.7, total: 3, recorded: 3 })];

describe("TierFolderNav (칩 띠)", () => {
  it("머리의 `‹ ›` 이웃 버튼은 없다 (아래 고정 막대가 맡는다)", () => {
    render(<TierFolderNav groups={groups} currentTier={5.8} />);
    expect(screen.queryByRole("navigation", { name: "인접 난이도" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /이전 난이도|다음 난이도/ })).not.toBeInTheDocument();
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

  it("D68: 지금 칩을 가운데로 맞출 때 칩 띠의 가로 스크롤만 옮기고 페이지 세로 스크롤(scrollIntoView)은 건드리지 않는다", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const rect = (left: number, width: number): DOMRect => ({ left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.tagName === "A" && this.getAttribute("aria-current") === "page") return rect(500, 50); // 지금 칩: 가운데 525
      if (this.tagName === "UL") return rect(0, 360); // 칩 띠: 가운데 180
      return rect(0, 0);
    });
    render(<TierFolderNav groups={groups} currentTier={5.8} />);
    const strip = within(screen.getByRole("navigation", { name: "난이도 목록" })).getByRole("list");
    expect(strip.scrollLeft).toBe(345); // 525 - 180
    expect(scrollIntoView).not.toHaveBeenCalled();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    vi.restoreAllMocks();
  });
});
