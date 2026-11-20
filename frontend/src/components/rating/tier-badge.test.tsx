import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TierBadge } from "@/components/rating/TierBadge";
import { TIER_STYLES } from "@/lib/rating-card";

describe("TierBadge (레이팅 카드의 큰 티어 배지, D87)", () => {
  it("10,000 아래 티어는 예전 칩 그대로다(장식 없음)", () => {
    render(<TierBadge tier={{ key: "ORANGE", displayName: "Orange" }} />);
    const chip = screen.getByText("Orange");
    expect(chip).toHaveClass("tier-chip");
    expect(document.querySelector("svg")).toBeNull();
  });

  const cases: [string, string, number, string][] = [
    ["SIX_FINGERS", "6 Fingers", 0, "rect"],
    ["MUTANT", "Mutant", 1, "rect"],
    ["ALIEN", "Alien", 2, "polygon"],
    ["HSB", "HSB", 3, "polygon"],
  ];
  for (const [key, name, ornament, shape] of cases) {
    it(`${name}: 이름 글자가 그대로 보이고 장식 단계 ${ornament}, 칩 모양 ${shape === "rect" ? "알약" : "육각"}`, () => {
      const { container } = render(<TierBadge tier={{ key, displayName: name }} />);
      expect(screen.getByText(name)).toBeInTheDocument(); // 색만으로 구분하지 않는다
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("data-tier", key);
      expect(svg).toHaveAttribute("data-ornament", String(ornament));
      expect(TIER_STYLES[key].chip?.ornament).toBe(ornament);
      // 칩 윤곽은 같은 모양이 겹쳐서(그림자, 금속, 하이라이트, 테두리, 안쪽 테두리) 5개다
      expect(container.querySelectorAll(`svg > ${shape}`)).toHaveLength(5);
      // 장식 선(path 수): 단계 1 = 마름모 2, 단계 2 = + 선 2(+ 점 circle 2), 단계 3 = + 곡선 3 + 위 마름모 1
      const ornaments = container.querySelector("svg > g");
      const count = (tag: string) => ornaments?.querySelectorAll(tag).length ?? 0;
      expect(count("path")).toBe([0, 2, 4, 8][ornament]);
      expect(count("circle")).toBe(ornament >= 2 ? 2 : 0);
    });
  }

  it("같은 화면에 배지가 둘이어도 그라데이션 id가 겹치지 않는다", () => {
    const { container } = render(
      <>
        <TierBadge tier={{ key: "HSB", displayName: "HSB" }} />
        <TierBadge tier={{ key: "ALIEN", displayName: "Alien" }} />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient, filter")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(8);
  });
});
