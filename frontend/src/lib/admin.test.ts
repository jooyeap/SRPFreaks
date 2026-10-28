import { describe, expect, it } from "vitest";
import { koT } from "@/i18n/ko-translator";
import { actionLabel, detailReadable, detailText } from "@/lib/admin";

describe("actionLabel", () => {
  it("아는 작업 종류는 화면 이름으로, 모르는 값은 그대로 보여 준다", () => {
    expect(actionLabel("SONG_DELETE", koT)).toBe("곡 삭제");
    expect(actionLabel("NICKNAME_CHANGE", koT)).toBe("닉네임 변경");
    expect(actionLabel("SOMETHING_NEW", koT)).toBe("SOMETHING_NEW");
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

describe("detailReadable", () => {
  it("없거나 비었으면 빈 문자열", () => {
    expect(detailReadable(null, koT)).toBe("");
    expect(detailReadable({}, koT)).toBe("");
  });

  it("before/after 값은 화살표로, 그 외 키는 화면 이름으로 보여 준다", () => {
    expect(detailReadable({ before: "KJY", after: "HJY" }, koT)).toBe("KJY → HJY");
    expect(detailReadable({ title: "공지" }, koT)).toBe("제목: 공지");
    expect(detailReadable({ title: "건의", status: "DONE" }, koT)).toBe("제목: 건의 · 상태: DONE");
    expect(detailReadable({ unknownKey: 3 }, koT)).toBe("unknownKey: 3"); // 모르는 키는 그대로
  });

  it("서열표 수정처럼 묶음끼리 비교하면 바뀐 칸만 보여 준다", () => {
    const text = detailReadable(
      {
        difficultyTableId: 1,
        songDifficultyId: 29,
        after: { tier: "5.7", recommend: "상", pattern: "단일", ratingEnabled: true },
        before: { tier: "5.6", recommend: "상", pattern: null, ratingEnabled: true },
      },
      koT,
    );
    expect(text).toBe("레이팅 상수 난이도: 5.6 → 5.7 · 속성: – → 단일 · 서열표 ID: 1 · 채보 ID: 29");
  });

  it("새로 만든 것(before 없음)은 만든 값을, 켜짐/꺼짐과 긴 목록은 줄여서 보여 준다", () => {
    expect(detailReadable({ after: { tier: "6.0", ratingEnabled: false } }, koT)).toBe("레이팅 상수 난이도: 6.0 · 레이팅 반영: 꺼짐");
    expect(detailReadable({ songIds: [1, 2, 3, 4, 5, 6, 7] }, koT)).toBe("곡 ID: 1, 2, 3, 4, 5 외 2개");
  });
});
