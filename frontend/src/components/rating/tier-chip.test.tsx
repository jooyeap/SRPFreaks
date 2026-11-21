import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TierBadge } from "@/components/rating/TierBadge";
import { TierChip } from "@/components/rating/TierChip";
import { PLAYER_TIER_MINS } from "@/lib/chart-tier";
import { TIER_CHIP_SIZES, TIER_CHIPS, tierChipWidth } from "@/lib/tier-chip";

describe("TierChip (티어 칩 공용 컴포넌트, D95)", () => {
  for (const tier of PLAYER_TIER_MINS) {
    it(`${tier.key}: 이름 글자가 보이고 모양·크기가 표를 따른다`, () => {
      const name = `Name ${tier.key}`;
      const { container } = render(<TierChip tier={{ key: tier.key, displayName: name }} />);
      expect(screen.getByText(name)).toBeInTheDocument(); // 색만으로 구분하지 않는다
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("data-tier", tier.key);
      expect(svg).toHaveAttribute("role", "group"); // img가 아니다: 같은 영역 차트 그림의 img 역할과 섞이지 않게
      expect(screen.getByLabelText(`플레이어 티어 ${name}`)).toBe(svg);
      const spec = TIER_CHIPS[tier.key];
      expect(svg).toHaveAttribute("data-shape", spec.shape);
      const { h, fs } = TIER_CHIP_SIZES.sm;
      expect(svg).toHaveAttribute("width", String(tierChipWidth(name, spec.shape, fs) + 4));
      expect(svg).toHaveAttribute("height", String(h + 6));
      // 옆 장식·글로우·반짝임이 없다: 윤곽 도형과 글자 말고는 그려지지 않는다
      expect(container.querySelector("svg g, path, circle, filter, animate, animateTransform")).toBeNull();
      expect(container.querySelectorAll(spec.shape === "pill" ? "svg > rect" : "svg > polygon").length).toBe(
        // 그림자 + 면 + (덧칠) + 하이라이트 + 테두리 계열(테두리 있음 2, 없음 1)
        1 + 1 + (spec.vertical ? 0 : 1) + 1 + (spec.border ? 2 : 1),
      );
    });
  }

  it("육각은 Alien·HSB(polygon), 알약은 6 Fingers·Mutant와 나머지(rect)", () => {
    const alien = render(<TierChip tier={{ key: "ALIEN", displayName: "Alien" }} />);
    expect(alien.container.querySelector("svg > polygon")).not.toBeNull();
    expect(alien.container.querySelector("svg > rect")).toBeNull();
    alien.unmount();
    const six = render(<TierChip tier={{ key: "SIX_FINGERS", displayName: "6 Fingers" }} />);
    expect(six.container.querySelector("svg > rect")).not.toBeNull();
    expect(six.container.querySelector("svg > polygon")).toBeNull();
  });

  it("짧은 이름은 최소 폭이고 긴 이름은 넓히지 않는다", () => {
    const widths = ["Red", "Rainbow Gradient"].map((name) => {
      const { container, unmount } = render(<TierChip tier={{ key: "RED", displayName: name }} />);
      const w = Number(container.querySelector("svg")!.getAttribute("width"));
      unmount();
      return w;
    });
    expect(widths[0]).toBe(81 + 4); // 최소 폭 11×7.4
    expect(widths[1]).toBe(123 + 4); // 글자 폭 + 여백만(최소 폭보다 큰 만큼만 넓다)
  });

  it("큰 크기(lg)는 글자 14px·높이 26px 칩이다", () => {
    const { container } = render(<TierChip tier={{ key: "GOLD", displayName: "Gold" }} size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("height", String(TIER_CHIP_SIZES.lg.h + 6));
    expect(container.querySelector("text")).toHaveAttribute("font-size", String(TIER_CHIP_SIZES.lg.fs));
  });

  it("알 수 없는 티어 key여도 이름 글자는 그대로 나온다", () => {
    render(<TierChip tier={{ key: "FUTURE", displayName: "Future" }} />);
    expect(screen.getByText("Future")).toBeInTheDocument();
  });

  it("같은 화면에 칩이 여럿이어도 그라데이션 id가 겹치지 않는다", () => {
    const { container } = render(
      <>
        <TierChip tier={{ key: "HSB", displayName: "HSB" }} />
        <TierChip tier={{ key: "ALIEN", displayName: "Alien" }} />
        <TierChip tier={{ key: "ORANGE", displayName: "Orange" }} />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(4 + 4 + 3); // 면+하이라이트+테두리(+덧칠): HSB 4, Alien 4, Orange(테두리 없음) 3
  });

  it("TierBadge는 큰 TierChip이다", () => {
    const { container } = render(<TierBadge tier={{ key: "MUTANT", displayName: "Mutant" }} />);
    expect(container.querySelector("svg")).toHaveAttribute("data-size", "lg");
    expect(screen.getByText("Mutant")).toBeInTheDocument();
  });
});
