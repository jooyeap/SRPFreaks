import { describe, expect, it } from "vitest";
import { countNicknameChars, nicknameSchema, normalizeNickname } from "@/lib/nickname";

const ok = (value: string) => nicknameSchema.safeParse(value);

describe("닉네임 검사", () => {
  it("2자 이상 12자 이하만 허용한다", () => {
    expect(ok("ab").success).toBe(true);
    expect(ok("a".repeat(12)).success).toBe(true);
    expect(ok("a").success).toBe(false);
    expect(ok("a".repeat(13)).success).toBe(false);
  });

  it("히라가나, 가타카나, 한자는 모두 한 글자로 센다", () => {
    expect(ok("あいうえおかきくけこさし").success).toBe(true); // 12자
    expect(ok("アイウエオカキクケコサシ").success).toBe(true);
    expect(ok("日本語日本語日本語日本語").success).toBe(true);
    expect(ok("日本語日本語日本語日本語日").success).toBe(false); // 13자
  });

  it("UTF-16 두 칸짜리 드문 한자도 한 글자로 센다", () => {
    expect(countNicknameChars("𠮷")).toBe(1);
    expect(ok("𠮷".repeat(12)).success).toBe(true);
    expect(ok("𠮷".repeat(13)).success).toBe(false);
  });

  it("영문, 숫자, 일본어와 허용 기호만 쓸 수 있다", () => {
    for (const valid of ["Taro_01", "たろう-ー・1", "佐々木", "〆切"]) {
      expect(ok(valid).success, valid).toBe(true);
    }
    for (const invalid of ["닉네임", "ta ro", "taro😀", "taro!", "café"]) {
      expect(ok(invalid).success, invalid).toBe(false);
    }
  });

  it("NFKC로 정규화한다 (반각 가타카나는 전각, 전각 영문·숫자는 반각)", () => {
    expect(normalizeNickname("ﾀﾛｳ")).toBe("タロウ");
    expect(normalizeNickname("Ｔａｒｏ１")).toBe("Taro1");
    expect(nicknameSchema.parse("  ﾀﾛｳ  ")).toBe("タロウ");
  });

  it("빈 값은 오류가 아니라 null(닉네임 없음)이다", () => {
    expect(nicknameSchema.parse("")).toBeNull();
    expect(nicknameSchema.parse("   ")).toBeNull();
  });

  it("오류 문구를 돌려준다", () => {
    const tooShort = ok("a");
    expect(tooShort.success ? "" : tooShort.error.issues[0].message).toBe("닉네임은 2자 이상 12자 이하여야 합니다.");
    const hangul = ok("닉네임");
    expect(hangul.success ? "" : hangul.error.issues[0].message).toContain("영문, 숫자, 일본어");
  });
});
