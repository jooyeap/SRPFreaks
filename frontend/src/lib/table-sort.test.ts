import { describe, expect, it } from "vitest";
import type { TableEntryResponse } from "@/lib/api-types";
import { SORT_OPTIONS, sortEntries } from "@/lib/table-sort";

function entry(id: number, title: string, rate: number | null, recommend: string | null): TableEntryResponse {
  return {
    entryId: id,
    songDifficultyId: id,
    songId: id,
    title,
    addedVersion: null,
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9,
    tierUncertain: false,
    recommend,
    recommendUncertain: false,
    pattern: "단일",
    patternUncertain: false,
    ratingEnabled: true,
    mine: rate === null ? null : { rate, fullCombo: false, stage: "A" },
  };
}

// 서버가 준 순서(레벨 높은 순)를 id 순서로 가정한다
const list = [entry(1, "Banana", 90.5, "하"), entry(2, "apple", null, "상"), entry(3, "Cherry", 99.1, null), entry(4, "あいう", 90.5, "중"), entry(5, "Dog", null, "상")];
const ids = (entries: readonly TableEntryResponse[]) => entries.map((e) => e.entryId);

describe("sortEntries", () => {
  it("선택지는 레벨 높은 순(기본)·달성률 높은/낮은 순·곡명 순·추천도 순이다", () => {
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual(["level", "rateDesc", "rateAsc", "title", "recommend"]);
  });

  it("레벨 높은 순은 서버 순서를 그대로 두고 원본을 바꾸지 않는다", () => {
    const result = sortEntries(list, "level");
    expect(ids(result)).toEqual([1, 2, 3, 4, 5]);
    expect(result).not.toBe(list);
  });

  it("달성률 높은 순: 기록 없는 채보는 맨 뒤, 같은 값은 서버 순서를 지킨다", () => {
    expect(ids(sortEntries(list, "rateDesc"))).toEqual([3, 1, 4, 2, 5]);
  });

  it("달성률 낮은 순에서도 기록 없는 채보는 맨 뒤다", () => {
    expect(ids(sortEntries(list, "rateAsc"))).toEqual([1, 4, 3, 2, 5]);
  });

  it("곡명 순: 영문은 대소문자 구분 없이, 일본어 가나도 함께 정렬한다", () => {
    const titles = sortEntries(list, "title").map((e) => e.title);
    expect(titles.slice(0, 4)).toEqual(["apple", "Banana", "Cherry", "Dog"]);
    expect(titles).toContain("あいう");
  });

  it("곡명의 숫자는 크기대로 정렬한다 (2가 10보다 앞)", () => {
    const sorted = sortEntries([entry(1, "Song 10", null, null), entry(2, "Song 2", null, null)], "title");
    expect(sorted.map((e) => e.title)).toEqual(["Song 2", "Song 10"]);
  });

  it("추천도 순: 상 > 중 > 하 > 없음, 같은 추천도는 서버 순서를 지킨다", () => {
    expect(ids(sortEntries(list, "recommend"))).toEqual([2, 5, 4, 1, 3]);
  });
});
