import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatingGoalPlanner } from "@/components/rating/RatingGoalPlanner";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";

// 직접 계산: A 6.0/80% = 240 (95%는 304, 여지 64), B 7.0/90% = 362.67 (95%는 384, 여지 21.33), C 6.0/90% = 282.67 (여지 21.33)
function entry(id: number, title: string, tier: number, rate: number, score: number): SkillEntryResponse {
  return {
    rank: id, songDifficultyId: id * 10, songId: id, title, part: "GUITAR", difficulty: "MASTER", level: 9, tier,
    pattern: "단일", achievementRate: rate, fullCombo: false, stage: "S", ratingConstant: 15, value: score / 20, score,
  };
}
const skill: SkillResponse = {
  noteOption: "SUPER_RANDOM_PLUS",
  totalScore: 1000,
  singleScore: 600,
  otherScore: 400,
  tier: { key: "ORANGE", displayName: "Orange", minScore: 1000, nextDisplayName: "Orange Gradient", nextMinScore: 1500 },
  singleLimit: 15,
  otherLimit: 25,
  single: [entry(2, "비곡", 7.0, 90, 362.6667)],
  other: [entry(1, "에이곡", 6.0, 80, 240), entry(3, "씨곡", 6.0, 90, 282.6667)],
};

function openAndType(value: string) {
  render(<RatingGoalPlanner skill={skill} />);
  fireEvent.click(screen.getByRole("button", { name: /목표 레이팅/ }));
  fireEvent.change(screen.getByLabelText("목표 점수"), { target: { value } });
}

describe("RatingGoalPlanner", () => {
  it("처음에는 접혀 있고 입력칸이 보이지 않는다", () => {
    render(<RatingGoalPlanner skill={skill} />);
    const toggle = screen.getByRole("button", { name: /목표 레이팅/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("목표 점수")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("목표 점수")).toHaveAttribute("placeholder", "지금 1000.00");
  });

  it("목표를 입력하면 곡 하나로 닿는 경로를 보여 준다 (1040: 에이곡 80.00% → 89.38%)", async () => {
    openAndType("1040");
    const list = await screen.findByRole("list", { name: "목표까지 올릴 곡" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByRole("link", { name: "에이곡" })).toHaveAttribute("href", "/songs/1?from=table&chart=10");
    expect(items[0]).toHaveTextContent("80.00% → 89.38%");
    expect(items[0]).toHaveTextContent("+40.00");
    expect(screen.getByText(/목표까지/)).toHaveTextContent("+40.00");
    expect(screen.getByText(/목표까지/)).toHaveTextContent("곡 1개를 올리면 달성합니다");
  });

  it("한 곡으로 모자라면 여러 곡을 순서대로 보여 준다 (1100 = 64 + 21.33 + 14.67 → 3곡, 마지막은 93.44%)", async () => {
    openAndType("1100");
    const items = within(await screen.findByRole("list", { name: "목표까지 올릴 곡" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("에이곡");
    expect(items[0]).toHaveTextContent("80.00% → 95.00%");
    expect(items[2]).toHaveTextContent("93.44%");
  });

  it("목록 안의 곡을 모두 올려도 모자라면 모자란 점수를 알려 준다 (1200: 106.67만 오르고 93.33 모자람)", async () => {
    openAndType("1200");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("+106.67");
    expect(alert).toHaveTextContent("93.33점이 모자랍니다");
  });

  it("이미 넘은 목표는 경로 대신 안내만 한다", async () => {
    openAndType("900");
    expect(await screen.findByText(/이미 목표를 넘었습니다/)).toHaveTextContent("1000.00");
    expect(screen.queryByRole("list", { name: "목표까지 올릴 곡" })).toBeNull();
  });

  it("형식이 틀리면 오류를 알리고 계산하지 않는다 (글자, 소수 셋째 자리, 0, 빈 값)", async () => {
    openAndType("abc");
    expect(await screen.findByRole("alert")).toHaveTextContent("숫자로 입력해 주세요");
    fireEvent.change(screen.getByLabelText("목표 점수"), { target: { value: "1050.123" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("소수는 둘째 자리까지"));
    fireEvent.change(screen.getByLabelText("목표 점수"), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("0보다 큰 값"));
    fireEvent.change(screen.getByLabelText("목표 점수"), { target: { value: "" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("입력해 주세요"));
    expect(screen.queryByRole("list", { name: "목표까지 올릴 곡" })).toBeNull();
  });

  it("다음 티어 버튼이 목표를 그 티어 최소 점수(1500)로 채운다", async () => {
    render(<RatingGoalPlanner skill={skill} />);
    fireEvent.click(screen.getByRole("button", { name: /목표 레이팅/ }));
    fireEvent.click(screen.getByRole("button", { name: "Orange Gradient (1500)로 정하기" }));
    expect(screen.getByLabelText("목표 점수")).toHaveValue("1500");
    // 1500은 이 목록으로는 닿지 못한다 (최대 +106.67)
    expect(await screen.findByRole("alert")).toHaveTextContent("모자랍니다");
  });

  it("최고 티어이면 다음 티어 버튼이 없다", () => {
    const top: SkillResponse = { ...skill, tier: { key: "HSB", displayName: "HSB", minScore: 11000, nextDisplayName: null, nextMinScore: null } };
    render(<RatingGoalPlanner skill={top} />);
    fireEvent.click(screen.getByRole("button", { name: /목표 레이팅/ }));
    expect(screen.queryByRole("button", { name: /로 정하기/ })).toBeNull();
  });
});
