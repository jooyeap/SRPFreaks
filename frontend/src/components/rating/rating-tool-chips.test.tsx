import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RatingToolChips } from "@/components/rating/RatingToolChips";
import type { SkillResponse } from "@/lib/api-types";
import ko from "../../../messages/ko.json";
import { resetHistoryLayersForTest } from "@/lib/history-layers";

// 펼침 안의 계산·내용은 이 PR에서 바뀌지 않으므로(각자의 테스트가 있다) 여기서는 "열리고 닫히는 것"만 본다.
vi.mock("@/components/rating/RatingGoalPlanner", () => ({ GoalBody: () => <p>목표 추산 본문</p> }));
vi.mock("@/components/rating/RatingTargetPlanner", () => ({ PlannerBody: () => <p>예상 값 본문</p> }));
vi.mock("@/lib/rating-card-draw", () => ({
  renderRatingCard: () => Promise.resolve({ toDataURL: () => "data:image/png;base64,AAAA", toBlob: vi.fn() }),
}));

const skill: SkillResponse = {
  noteOption: "SUPER_RANDOM_PLUS", totalScore: 100, singleScore: 100, otherScore: 0,
  tier: { key: "WHITE", displayName: "White", minScore: 0, nextDisplayName: null, nextMinScore: null },
  singleLimit: 15, otherLimit: 25,
  single: [{
    rank: 1, songDifficultyId: 1, songId: 1, title: "곡", part: "GUITAR", difficulty: "MASTER", level: 9, tier: 9, pattern: "단일",
    achievementRate: 90, fullCombo: false, stage: "S", ratingConstant: 30, value: 5, score: 100,
  }],
  other: [],
};

function ui(s: SkillResponse = skill) {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <RatingToolChips userId={1} skill={s} />
    </NextIntlClientProvider>,
  );
}

describe("RatingToolChips", () => {
  beforeEach(() => resetHistoryLayersForTest());

  it("칩 세 개가 한 줄에 순서대로 있고, 처음에는 아무것도 펼쳐져 있지 않다", () => {
    ui();
    const chips = screen.getAllByRole("button");
    expect(chips.map((b) => b.textContent?.replace(/[▴▾]/g, "").trim())).toEqual(["목표 레이팅 추산", "레이팅 예상 값", "카드 이미지 저장"]);
    // 한 줄: 세 칩이 같은 flex 줄 안에 있다. 터치 영역 44px 이상
    expect(new Set(chips.map((b) => b.parentElement)).size).toBe(1);
    for (const b of chips) expect(b.className).toContain("min-h-11");
    expect(screen.queryByText("목표 추산 본문")).toBeNull();
    expect(screen.queryByText("예상 값 본문")).toBeNull();
    expect(screen.getByRole("button", { name: /목표 레이팅 추산/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("앞의 두 칩은 누르면 칩 아래에 기존 펼침 내용이 열리고, 한 번에 하나만 열린다", () => {
    ui();
    const goal = screen.getByRole("button", { name: /목표 레이팅 추산/ });
    const target = screen.getByRole("button", { name: /레이팅 예상 값/ });
    fireEvent.click(goal);
    expect(goal).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("region", { name: "목표 레이팅 추산" })).getByText("목표 추산 본문")).toBeInTheDocument();
    // 다른 칩을 누르면 바뀐다(둘이 동시에 열리지 않는다)
    fireEvent.click(target);
    expect(screen.queryByText("목표 추산 본문")).toBeNull();
    expect(screen.getByText("예상 값 본문")).toBeInTheDocument();
    expect(goal).toHaveAttribute("aria-expanded", "false");
    expect(target).toHaveAttribute("aria-expanded", "true");
    // 같은 칩을 다시 누르면 닫힌다
    fireEvent.click(target);
    expect(screen.queryByText("예상 값 본문")).toBeNull();
    expect(target).toHaveAttribute("aria-expanded", "false");
  });

  it("카드 이미지 저장 칩은 기존 대화상자를 열고, 펼침 상태는 건드리지 않는다", async () => {
    ui();
    fireEvent.click(screen.getByRole("button", { name: /목표 레이팅 추산/ }));
    fireEvent.click(screen.getByRole("button", { name: "카드 이미지 저장" }));
    expect(await screen.findByAltText("레이팅 카드 미리보기")).toBeInTheDocument();
    expect(screen.getByText("목표 추산 본문")).toBeInTheDocument();
  });

  it("레이팅에 곡이 하나도 없으면 카드 이미지 칩은 없다", () => {
    ui({ ...skill, single: [] });
    expect(screen.queryByRole("button", { name: "카드 이미지 저장" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
