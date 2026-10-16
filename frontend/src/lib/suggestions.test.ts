import { describe, expect, it } from "vitest";
import { parseCategory, suggestionSchema } from "@/lib/suggestions";

describe("suggestionSchema", () => {
  it("앞뒤 공백을 자르고 비어 있거나 너무 길면 거부한다", () => {
    expect(suggestionSchema.safeParse({ category: "BUG", title: " 제목 ", content: " 내용 " })).toMatchObject({
      success: true,
      data: { category: "BUG", title: "제목", content: "내용" },
    });
    expect(suggestionSchema.safeParse({ category: "BUG", title: "  ", content: "내용" }).success).toBe(false);
    expect(suggestionSchema.safeParse({ category: "BUG", title: "제목", content: "" }).success).toBe(false);
    expect(suggestionSchema.safeParse({ category: "BUG", title: "가".repeat(101), content: "내용" }).success).toBe(false);
    expect(suggestionSchema.safeParse({ category: "BUG", title: "가".repeat(100), content: "가".repeat(2000) }).success).toBe(true);
    expect(suggestionSchema.safeParse({ category: "BUG", title: "제목", content: "가".repeat(2001) }).success).toBe(false);
  });

  it("모르는 종류는 거부한다", () => {
    expect(suggestionSchema.safeParse({ category: "HACK", title: "제목", content: "내용" }).success).toBe(false);
  });
});

describe("parseCategory", () => {
  it("알려진 종류만 돌려주고 나머지는 null이다", () => {
    expect(parseCategory("SONG_REQUEST")).toBe("SONG_REQUEST");
    expect(parseCategory("song_request")).toBeNull();
    expect(parseCategory("<script>")).toBeNull();
    expect(parseCategory(null)).toBeNull();
  });
});
