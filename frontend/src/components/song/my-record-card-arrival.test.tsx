import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyRecordCard } from "@/components/song/MyRecordCard";

const chart = { part: "GUITAR", difficulty: "EXTREME", level: 8.2 } as const;

describe("내 기록 카드: 서열표 변경 알림에서 왔을 때 (D61)", () => {
  it("내 점수 전 → 후와 차이(+/- 글자)를 보이고 카드를 강조한다", () => {
    render(
      <MyRecordCard mine={null} best={null} chart={chart} emphasizeSrn onRecord={() => {}}
        arrival={{ beforeTier: 6.5, afterTier: 7, beforeScore: 322.67, afterScore: 362.67 }} />,
    );
    const card = screen.getByRole("region", { name: "내 기록" });
    expect(card.className).toContain("arrive-glow");
    expect(card).toHaveTextContent("내 점수");
    expect(card).toHaveTextContent("이전 값 322.67");
    expect(card).toHaveTextContent("362.67");
    expect(card).toHaveTextContent("+40.00");
  });

  it("미정이면 `미정`으로 쓰고 차이는 쓰지 않는다. 알림에서 오지 않았으면 줄이 없다", () => {
    const { rerender } = render(
      <MyRecordCard mine={null} best={null} chart={chart} emphasizeSrn={false} onRecord={() => {}}
        arrival={{ beforeTier: null, afterTier: 7, beforeScore: null, afterScore: 362.67 }} />,
    );
    const card = screen.getByRole("region", { name: "내 기록" });
    expect(card).toHaveTextContent("이전 값 미정");
    expect(card).not.toHaveTextContent("+");
    rerender(<MyRecordCard mine={null} best={null} chart={chart} emphasizeSrn={false} onRecord={() => {}} />);
    expect(screen.getByRole("region", { name: "내 기록" })).not.toHaveTextContent("내 점수");
  });
});
