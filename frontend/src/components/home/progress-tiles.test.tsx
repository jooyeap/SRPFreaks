import { fireEvent, render, screen } from "@testing-library/react";
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

  it("기록이 하나도 없는 칸은 0% 대신 한 줄 안내를 보이고, 칩은 없고 테두리가 점선이다", () => {
    render(<ProgressTiles label="칸" groups={[group({ key: "6.5", label: "6.5", href: "/b", total: 12 })]} />);
    const link = screen.getByRole("link", { name: /6\.5/ });
    expect(cardChips(link)).toEqual([]);
    expect(link).toHaveTextContent("아직 기록이 없습니다");
    expect(link.className).toContain("sm:border-dashed");
    // 넓은 화면 카드에는 큰 퍼센트 숫자(text-xl)가 없다. 모바일 표형 줄의 0%는 그대로다
    expect(link.querySelector(".text-xl")).toBeNull();
  });

  it("EXC·FC 줄이 모두 0이면 그 줄은 비우고 아래 줄만 남긴다", () => {
    render(<ProgressTiles label="칸" groups={[group({ key: "5.5", label: "5.5", href: "/c", total: 5, recorded: 1, belowS: 1 })]} />);
    expect(cardChips(screen.getByRole("link", { name: /5\.5/ }))).toEqual(["S 미만 1"]);
  });
});

describe("진행도 칸 지도의 높은 구간 접기", () => {
  const groups = [
    group({ key: "merged-high", label: "6.5 이상", href: "/table", total: 9 }),
    group({ key: "6.4", label: "6.4", href: "/table/folder/6.4", total: 4 }),
    group({ key: "5.8", label: "5.8", href: "/table/folder/5.8", total: 49, recorded: 3, s: 2, belowS: 1 }),
  ];

  it("맨 위 n개 구간을 한 줄로 접고, 누르면 펼치고 다시 접는다", () => {
    render(<ProgressTiles label="칸" groups={groups} foldCount={2} />);
    const toggle = screen.getByRole("button", { name: /6\.5 이상 ~ 6\.4 · 기록 없는 구간 2개/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /6\.4/ })).toBeNull();
    expect(screen.getByRole("link", { name: /5\.8/ })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("기록 없는 높은 구간 접기");
    expect(screen.getByRole("link", { name: /6\.4/ })).toBeInTheDocument();
  });

  it("foldCount가 0이면 접기 줄 없이 모두 보인다", () => {
    render(<ProgressTiles label="칸" groups={groups} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});
