import { describe, expect, it } from "vitest";
import { actionLabel, detailText } from "@/lib/admin";

describe("actionLabel", () => {
  it("아는 작업 종류는 화면 이름으로, 모르는 값은 그대로 보여 준다", () => {
    expect(actionLabel("SONG_DELETE")).toBe("곡 삭제");
    expect(actionLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("detailText", () => {
  it("없거나 비었으면 빈 문자열", () => {
    expect(detailText(null)).toBe("");
    expect(detailText({})).toBe("");
  });

  it("JSON 한 줄로 보여 주고 길면 자른다", () => {
    expect(detailText({ title: "곡" })).toBe('{"title":"곡"}');
    const long = detailText({ text: "가".repeat(500) }, 20);
    expect(long).toHaveLength(21);
    expect(long.endsWith("…")).toBe(true);
  });
});
