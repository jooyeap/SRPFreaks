import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RatingCardButton } from "@/components/rating/RatingCardDialog";
import type { SkillResponse } from "@/lib/api-types";
import ko from "../../../messages/ko.json";
import { resetHistoryLayersForTest } from "@/lib/history-layers";

const render2d = vi.fn();
vi.mock("@/lib/rating-card-draw", () => ({
  renderRatingCard: (model: unknown) => render2d(model),
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

function ui(s: SkillResponse) {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <RatingCardButton skill={s} />
    </NextIntlClientProvider>,
  );
}

describe("RatingCardButton", () => {
  beforeEach(() => {
    render2d.mockReset();
    render2d.mockResolvedValue({ toDataURL: () => "data:image/png;base64,AAAA", toBlob: vi.fn() });
  });

  it("곡이 없으면 버튼을 그리지 않는다", () => {
    ui({ ...skill, single: [] });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("누르면 창이 열리고 미리보기를 보여 준다", async () => {
    ui(skill);
    fireEvent.click(screen.getByRole("button", { name: "카드 이미지 저장" }));
    const img = await screen.findByAltText("레이팅 카드 미리보기");
    expect(img).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(screen.getByRole("button", { name: "PNG 저장" })).toBeEnabled();
  });

  it("배치를 바꾸면 다시 그린다", async () => {
    ui(skill);
    fireEvent.click(screen.getByRole("button", { name: "카드 이미지 저장" }));
    await screen.findByAltText("레이팅 카드 미리보기");
    fireEvent.click(screen.getByRole("radio", { name: "세로" }));
    await waitFor(() => expect(render2d).toHaveBeenCalledTimes(2));
    expect(render2d.mock.calls[1][0].layout).toBe("portrait");
  });

  it("그리기에 실패하면 안내를 보이고 저장은 막는다", async () => {
    render2d.mockRejectedValue(new Error("x"));
    ui(skill);
    fireEvent.click(screen.getByRole("button", { name: "카드 이미지 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이미지를 만들지 못했습니다");
    expect(screen.getByRole("button", { name: "PNG 저장" })).toBeDisabled();
  });

  it("뒤로 가기를 누르면 카드 창만 닫힌다(주소는 그대로)", async () => {
    resetHistoryLayersForTest();
    window.history.replaceState(null, "", "/prev");
    window.history.pushState(null, "", "/here");
    ui(skill);
    fireEvent.click(screen.getByRole("button", { name: "카드 이미지 저장" }));
    await screen.findByAltText("레이팅 카드 미리보기");
    window.history.back();
    await waitFor(() => expect(screen.queryByAltText("레이팅 카드 미리보기")).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/here");
    resetHistoryLayersForTest();
  });
});
