import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatingEntryCard } from "@/components/rating/RatingEntryCard";
import type { SkillEntryResponse } from "@/lib/api-types";

const entry: SkillEntryResponse = {
  rank: 1, songDifficultyId: 10, songId: 100, title: "KAISER PHOENIX", part: "GUITAR", difficulty: "MASTER", level: 9.9, tier: 9.4,
  pattern: "단일", achievementRate: 95.75, fullCombo: false, stage: "SS", ratingConstant: 32, value: 12, score: 240,
};

describe("레이팅 카드 (2026-11-02, 알약 통일 A)", () => {
  it("오른쪽에 점수와 [SS | 95.75] 알약, 알약 줄에는 단계 배지가 따로 없다", () => {
    render(<ul><RatingEntryCard entry={entry} /></ul>);
    const card = screen.getByRole("listitem");
    expect(card).toHaveTextContent("240.00");
    const stages = within(card).getAllByLabelText("달성 단계 SS");
    expect(stages).toHaveLength(1);
    expect(stages[0].parentElement).toHaveTextContent("SS95.75");
  });

  it("100.00은 MAX로 보인다", () => {
    render(<ul><RatingEntryCard entry={{ ...entry, achievementRate: 100, stage: "EXC" }} /></ul>);
    expect(screen.getByLabelText("달성 단계 EXC").parentElement).toHaveTextContent("EXCMAX");
  });
});
