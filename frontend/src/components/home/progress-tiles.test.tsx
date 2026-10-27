import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressTiles } from "@/components/home/ProgressTiles";
import type { ProgressGroup } from "@/lib/difficulty-table";

function group(over: Partial<ProgressGroup>): ProgressGroup {
  return { key: "6.0", label: "6.0", href: "/table/folder/6.0", total: 10, recorded: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, ...over };
}

/** 넓은 화면(sm 이상) 카드의 단계 칩만 고른다. 모바일 표형 줄의 칸에는 테두리 칩 모양(rounded-md)이 없다 */
function cardChips(link: HTMLElement): string[] {
  return Array.from(link.querySelectorAll("span.rounded-md")).map((el) => el.textContent ?? "");
}

describe("진행도 칸 지도의 단계 칩 (넓은 화면 카드)", () => {
  it("0이 아닌 단계만 칩으로 보이고, 순서는 그대로다", () => {
    render(<ProgressTiles label="칸" groups={[group({ key: "7.0", label: "7.0", href: "/a", total: 12, recorded: 3, ss: 1, s: 2 })]} />);
    const link = screen.getByRole("link", { name: /7\.0/ });
    expect(cardChips(link)).toEqual(["SS 1", "S 2"]);
    expect(link).not.toHaveTextContent("아직 기록이 없습니다");
    expect(link.className).not.toContain("sm:border-dashed");
  });

  it("기록이 하나도 없는 칸은 칩 대신 한 줄 안내를 보이고 테두리가 점선이다", () => {
    render(<ProgressTiles label="칸" groups={[group({ key: "6.5", label: "6.5", href: "/b", total: 12 })]} />);
    const link = screen.getByRole("link", { name: /6\.5/ });
    expect(cardChips(link)).toEqual([]);
    expect(link).toHaveTextContent("아직 기록이 없습니다");
    expect(link.className).toContain("sm:border-dashed");
  });

  it("EXC·FC 줄이 모두 0이면 그 줄은 비우고 아래 줄만 남긴다", () => {
    render(<ProgressTiles label="칸" groups={[group({ key: "5.5", label: "5.5", href: "/c", total: 5, recorded: 1, belowS: 1 })]} />);
    expect(cardChips(screen.getByRole("link", { name: /5\.5/ }))).toEqual(["S 미만 1"]);
  });
});
