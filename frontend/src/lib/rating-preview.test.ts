import { describe, expect, it } from "vitest";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { previewRatingChange, ratingPreviewText } from "@/lib/rating-preview";

function entry(id: number, score: number, pattern = "단일"): SkillEntryResponse {
  return { rank: 1, songDifficultyId: id, songId: id, title: `곡${id}`, score, pattern, tier: 6 } as SkillEntryResponse;
}
function skill(single: SkillEntryResponse[], other: SkillEntryResponse[], singleLimit = 3, otherLimit = 3): SkillResponse {
  return { single, other, singleLimit, otherLimit } as SkillResponse;
}

describe("previewRatingChange", () => {
  const full = skill([entry(1, 300), entry(2, 200), entry(3, 100)], [entry(4, 50, "복합")]);

  it("꽉 찬 구역에서 맨 아래보다 높으면 그 곡을 밀어내고 차이만큼 오른다 (NEW)", () => {
    // 새 곡 150: 300+200+150 - (300+200+100) = +50
    expect(previewRatingChange(full, 9, 150, "단일")).toEqual({ change: 50, inList: true, entered: true });
  });

  it("맨 아래보다 낮으면 목록에 못 들고 변화가 없다", () => {
    expect(previewRatingChange(full, 9, 90, "단일")).toEqual({ change: 0, inList: false, entered: false });
  });

  it("덜 찬 구역은 점수가 그대로 더해진다 (속성이 단일이 아니면 그 외 구역)", () => {
    expect(previewRatingChange(full, 9, 70, "복합")).toEqual({ change: 70, inList: true, entered: true });
  });

  it("이미 목록에 있는 곡이 오르면 NEW가 아니고 오른 만큼 증가한다", () => {
    expect(previewRatingChange(full, 3, 160, undefined)).toEqual({ change: 60, inList: true, entered: false });
  });

  it("목록에 있는 곡에 낮은 기록을 넣으면 가장 높은 기록이 그대로 쓰여 변화가 없다", () => {
    expect(previewRatingChange(full, 2, 50, null)).toEqual({ change: 0, inList: true, entered: false });
  });

  it("지금 반영된 기록을 낮게 고치면 다음 기록을 몰라서 예상하지 않는다", () => {
    expect(previewRatingChange(full, 2, 50, null, true)).toBeNull();
    expect(previewRatingChange(full, 2, 250, null, true)).toEqual({ change: 50, inList: true, entered: false });
  });

  it("속성이 없거나 레이팅 제외이고 목록에도 없으면 레이팅 대상이 아니다", () => {
    expect(previewRatingChange(full, 9, 150, null)).toBeNull();
    expect(previewRatingChange(full, 9, 150, "레이팅 제외")).toBeNull();
  });
});

describe("ratingPreviewText", () => {
  it("오르면 + 부호로, 새로 들어가면 NEW를 덧붙인다", () => {
    expect(ratingPreviewText({ change: 3.4, inList: true, entered: false })).toBe("예상 레이팅 +3.40");
    expect(ratingPreviewText({ change: 3.4, inList: true, entered: true })).toBe("예상 레이팅 +3.40 · NEW 레이팅 목록에 새로 들어갑니다");
  });

  it("변화가 없으면 이유를 알려 준다", () => {
    expect(ratingPreviewText({ change: 0, inList: true, entered: false })).toBe("레이팅 변화 없음");
    expect(ratingPreviewText({ change: 0, inList: false, entered: false })).toBe("레이팅 변화 없음 · 아직 레이팅 목록에는 들지 못합니다");
  });
});
