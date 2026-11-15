import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";
import { BarFill } from "@/components/BarFill";
import { ValueSwap } from "@/components/ValueSwap";
import { ProgressDonut } from "@/components/home/ProgressDonut";
import { StageBar } from "@/components/table/StageBar";
import type { ProgressSummary } from "@/lib/progress";
import { resetFirstAppearance } from "@/lib/use-first-appearance";
import koMessages from "../../messages/ko.json";

// 숫자·막대·도넛 모션 (D82, 모션 PR 5): 처음 나타날 때·값이 바뀔 때만 재생하고, 글자는 처음부터 최종 값이다.
beforeEach(() => resetFirstAppearance());

describe("BarFill", () => {
  it("처음 나타날 때만 모션 클래스를 붙이고, 같은 마운트의 리렌더에는 그대로 두며 폭은 바로 최종 값이다", () => {
    const { rerender } = render(<BarFill motionKey="k1" className="x" style={{ width: "40%" }} />);
    expect(document.querySelector(".x")!.className).toContain("motion-bar-fill");
    expect(document.querySelector(".x")).toHaveStyle({ width: "40%" });
    rerender(<BarFill motionKey="k1" className="x" style={{ width: "60%" }} />);
    expect(document.querySelector(".x")).toHaveStyle({ width: "60%" });
  });

  it("같은 키가 다시 마운트되면(탭 다시 방문) 재생하지 않는다", () => {
    const first = render(<BarFill motionKey="k2" className="y" />);
    expect(document.querySelector(".y")!.className).toContain("motion-bar-fill");
    first.unmount();
    render(<BarFill motionKey="k2" className="y" />);
    expect(document.querySelector(".y")!.className).not.toContain("motion-bar-fill");
  });

  it("키가 없으면(값을 모르는 자리) 모션이 없고, 8번째 막대부터는 모션이 없다", () => {
    render(
      <>
        <BarFill className="n" />
        <BarFill motionKey="k3" index={8} className="m" />
        <BarFill motionKey="k4" index={7} className="l" />
      </>,
    );
    expect(document.querySelector(".n")!.className).not.toContain("motion-bar-fill");
    expect(document.querySelector(".m")!.className).not.toContain("motion-bar-fill");
    expect(document.querySelector(".l")!.className).toContain("motion-bar-fill");
  });

  it("장식 막대는 aria-hidden이고 rtl이면 반대 방향 클래스를 쓴다", () => {
    render(<BarFill decorative rtl motionKey="k5" className="z" />);
    const bar = document.querySelector(".z")!;
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar.className).toContain("motion-bar-fill-rtl");
  });
});

describe("StageBar 채움 모션", () => {
  const counts = { exc: 1, fc: 1, ss: 1, sPlus: 0, s: 1, belowS: 1 };

  it("키를 주면 막대 전체(이어진 칸 한 덩어리)에 모션 클래스가 붙고 칸 너비는 그대로다", () => {
    render(<StageBar counts={counts} total={10} className="h-2" motionKey="sb1" />);
    const bar = document.querySelector("[data-stage-bar]")!;
    expect(bar.className).toContain("motion-bar-fill");
    expect(bar.querySelectorAll("[data-stage]").length).toBe(5);
    expect(bar.querySelector('[data-stage="EXC"]')).toHaveStyle({ width: "10%" });
    expect(bar.querySelector("[data-stage].motion-bar-fill")).toBeNull();
  });

  it("키가 없거나 전체가 0이면(불러오는 중·빈 값) 모션이 없다", () => {
    render(
      <>
        <StageBar counts={counts} total={10} className="a" />
        <StageBar counts={counts} total={0} className="b" motionKey="sb2" />
      </>,
    );
    for (const el of document.querySelectorAll("[data-stage-bar]")) expect(el.className).not.toContain("motion-bar-fill");
  });
});

describe("ValueSwap", () => {
  it("처음 그릴 때는 모션이 없고 글자는 바로 최종 값이다", () => {
    render(<ValueSwap value={10}>10</ValueSwap>);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(document.querySelector(".motion-value-swap")).toBeNull();
  });

  it("값이 바뀌면 새 값이 모션 클래스와 함께 바로 나오고, 같은 값 리렌더에는 다시 재생하지 않는다", () => {
    const { rerender } = render(<ValueSwap value={10}>10</ValueSwap>);
    rerender(<ValueSwap value={12}>12</ValueSwap>);
    const el = screen.getByText("12");
    expect(el.className).toContain("motion-value-swap");
    rerender(<ValueSwap value={12}>12</ValueSwap>);
    expect(screen.getByText("12")).toBe(el); // 같은 요소(다시 마운트되지 않음)
  });

  it("불러오는 중(값 없음) → 불러옴은 바뀐 것으로 세지 않고, 그 뒤의 바뀜만 센다", () => {
    const { rerender } = render(<ValueSwap value={null}>–</ValueSwap>);
    rerender(<ValueSwap value={5}>5</ValueSwap>);
    expect(document.querySelector(".motion-value-swap")).toBeNull();
    rerender(<ValueSwap value={6}>6</ValueSwap>);
    expect(document.querySelector(".motion-value-swap")).not.toBeNull();
  });
});

describe("ProgressDonut 그리기 모션", () => {
  const progress: ProgressSummary = {
    total: 100,
    recorded: 40,
    exc: 5,
    fc: 5,
    ss: 10,
    sPlus: 5,
    s: 5,
    belowS: 10,
    groups: [],
  } as unknown as ProgressSummary;

  function renderDonut() {
    return render(
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        <ProgressDonut progress={progress} />
      </NextIntlClientProvider>,
    );
  }

  it("처음에는 호 그룹에 마스크 원(dashoffset 모션)이 붙고 호와 가운데 글자는 이미 최종 값이다", () => {
    renderDonut();
    expect(document.querySelector("[data-donut-draw]")).not.toBeNull();
    expect(document.querySelector("mask")).not.toBeNull();
    expect(document.querySelectorAll("[data-donut] [data-arc]").length).toBe(6);
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "기록 40 / 100곡")).toBeInTheDocument();
  });

  it("같은 도넛이 다시 마운트되면 마스크 없이 바로 그려진다", () => {
    renderDonut().unmount();
    renderDonut();
    expect(document.querySelector("[data-donut-draw]")).toBeNull();
    expect(document.querySelectorAll("[data-donut] [data-arc]").length).toBe(6);
  });
});
