import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TierBadge } from "@/components/rating/TierBadge";
import { TIER_STYLES } from "@/lib/rating-card";

describe("TierBadge (레이팅 카드의 큰 티어 배지, D87)", () => {
  it("10,000 아래 티어는 예전 칩 그대로다(칩 질감 없음)", () => {
    render(<TierBadge tier={{ key: "ORANGE", displayName: "Orange" }} />);
    const chip = screen.getByText("Orange");
    expect(chip).toHaveClass("tier-chip");
    expect(document.querySelector("svg")).toBeNull();
  });

  const cases: [string, string, string][] = [
    ["SIX_FINGERS", "6 Fingers", "rect"],
    ["MUTANT", "Mutant", "rect"],
    ["ALIEN", "Alien", "polygon"],
    ["HSB", "HSB", "polygon"],
  ];
  for (const [key, name, shape] of cases) {
    it(`${name}: 이름 글자가 그대로 보이고 칩 모양은 ${shape === "rect" ? "알약" : "육각"}이며 옆 장식은 없다`, () => {
      const { container } = render(<TierBadge tier={{ key, displayName: name }} />);
      expect(screen.getByText(name)).toBeInTheDocument(); // 색만으로 구분하지 않는다
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("data-tier", key);
      expect(TIER_STYLES[key].chip?.shape).toBe(shape === "rect" ? "pill" : "hex");
      // 칩 윤곽은 같은 모양이 겹쳐서(그림자, 금속, 하이라이트, 테두리, 안쪽 테두리) 5개다
      expect(container.querySelectorAll(`svg > ${shape}`)).toHaveLength(5);
      // 사용자 요청(2026-11-21)으로 양옆 장식(마름모·선·점·곡선)을 뺐다: 윤곽 말고 그려지는 도형이 없다
      expect(container.querySelector("svg > g")).toBeNull();
      expect(container.querySelector("path, circle")).toBeNull();
      expect(svg?.hasAttribute("data-ornament")).toBe(false);
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
